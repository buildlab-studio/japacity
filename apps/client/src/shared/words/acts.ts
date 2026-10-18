// Acts that answer in the place (activity:now-acts-and-month-acts): an entry says when it answers. A now-act's
// card sends it at once and the place answers in a person's voice; a month-act fills a slot of the month.
import type { ServerRejection } from "@japacity/api";
import { content } from "@japacity/content";
import type { Id, Reply, ReportLine, SlotPick } from "@japacity/sim";

import { hasWords, nameOf, say, words } from "./text";

const NOW_LINE = /^line\.activity\.[a-z0-9-]+\.now$/;

/** True when the entry answers now: its card sends `activity/now`, and it never fills a slot of the month. */
export function answersNow(activity: string): boolean {
  return content.activity[activity as keyof typeof content.activity]?.when === "now";
}

/**
 * The month's free time an act done at once takes, in words (activity:now-acts-spend-half-days): a morning for 1 half-day, a day for 2,
 * a weekend for 4, a week for 10, and between them the nearer below. Null for a purchase or an act that takes the month,
 * which spend none of it.
 */
export function timeWordsOf(activity: string, halfDays?: number): string | null {
  const entry = content.activity[activity as keyof typeof content.activity];
  if (entry === undefined || entry.when !== "now" || entry.purchase === true) return null;
  // The view's own time when a thing owned changes it (the gas cooker's pot), else the entry's.
  const half = halfDays ?? entry.halfDays ?? 1;
  // An act that takes no time (gist, a look) says none (activity:spent-body-refuses-acts).
  if (half <= 0) return null;
  const span = half <= 1 ? "morning" : half < 4 ? "day" : half < 6 ? "weekend" : half < 10 ? "half-week" : "week";
  return say(`ui.world.time.${span}`);
}

/** The body's qualities and what an act that adds to them does, in words (quality:body-belly-and-energy: never a figure for the body). */
const BODY_DOES: Readonly<Record<string, string>> = { "quality.belly": "ui.act.does.fills", "quality.energy": "ui.act.does.rests", "quality.wellbeing": "ui.act.does.lifts" };

/** The groups of quality an act's sheet may name with its figure: a skill or a proof ("+2 English"). */
const SKILLS: ReadonlySet<string> = new Set(["skills", "proof"]);

/**
 * What an act does, in words, on one line (world:one-action-one-sheet): from its `quality/add` effects, short: "Fills you" for the belly,
 * "rests you" for the energy, "lifts you" for wellbeing, and a skill with its figure, "+2 English". Null when it adds
 * none of these.
 */
export function effectWordsOf(activity: string): string | null {
  const entry = content.activity[activity as keyof typeof content.activity];
  if (entry === undefined) return null;
  const parts = entry.effects.flatMap((effect) => {
    if (effect.type !== "quality/add" || effect.amount <= 0) return [];
    const body = BODY_DOES[effect.quality];
    if (body !== undefined) return [say(body)];
    return SKILLS.has(content.quality[effect.quality]?.group ?? "") ? [say("ui.act.does.skill", { amount: effect.amount, skill: nameOf(effect.quality) })] : [];
  });
  const line = [...new Set(parts)].join(", ");
  return line === "" ? null : line.charAt(0).toUpperCase() + line.slice(1);
}

/** Rest, which an empty slot already is (turn:free-slots-per-month): never planned, never a thing's act, never in a picker. */
const REST = "activity.rest";

/**
 * True when the entry may be planned into the month's free time (turn:free-slots-per-month, activity:now-acts-and-month-acts): a month-act
 * that fills a slot. A now-act is done at once, and rest is what an empty slot does, so neither is ever planned.
 */
export function plannable(activity: string): boolean {
  const entry = content.activity[activity as keyof typeof content.activity];
  return entry !== undefined && entry.slot !== "none" && entry.when !== "now" && activity !== REST;
}

/** The view's acts a picker lists: every one but rest, which an empty slot already is (turn:free-slots-per-month). */
export function pickable<T extends { id: string }>(options: readonly T[]): T[] {
  return options.filter((option) => option.id !== REST);
}

/** The place's answer among a command's lines, `line.activity.<slug>.now`, or null when it holds none. */
export function nowLineIn(lines: readonly ReportLine[]): ReportLine | null {
  return lines.find((line) => NOW_LINE.test(line.key)) ?? null;
}

/** The acts the month's now-lines answered, each once: what was done at once this month, an act that repeats among them. */
export function nowActsIn(lines: readonly ReportLine[]): string[] {
  return [...new Set(lines.flatMap((line) => (NOW_LINE.test(line.key) ? [nowActOf(line)] : [])).filter((activity) => activity !== ""))];
}

/** The act a now-line answers, from its params. */
export function nowActOf(line: Pick<ReportLine, "params">): string {
  return typeof line.params.activity === "string" ? line.params.activity : "";
}

/**
 * A now-line's words: the line's own for the thing picked where content has one (`<key>.<slug>`: the racks' answer to a
 * hunt), else the line with its param.
 */
export function nowLineWords(line: Pick<ReportLine, "key" | "params">): string {
  const { param } = line.params;
  const own = typeof param === "string" ? `${line.key}.${param.replace(/^[a-z]+\./, "")}` : null;
  return words(own !== null && hasWords(own) ? own : line.key, line.params);
}

/** What the place says for a now-act with no paper to wait on (the official page read from the phone): its now-line with the act and its param. */
export function nowSaid(activity: string, param: string | null): string {
  return nowLineWords({ key: `line.activity.${activity.replace(/^activity\./, "")}.now`, params: param === null ? { activity } : { activity, param } });
}

/** What a card's button needs of the game store. */
export interface ActStore {
  send: (command: { type: "activity/now"; activity: Id<"activity">; param: string | null }) => Promise<Reply | ServerRejection | null>;
  addToPlan: (pick: SlotPick) => boolean;
}

export type Acted = "answered" | "refused" | "planned" | "full";

/**
 * A card's main button, wherever the card is (a thing's sheet, the picker, the phone): a now-act is sent at once and
 * answered in the place; a month-act fills the next free slot.
 */
export async function actOnCard(pick: SlotPick, store: ActStore): Promise<Acted> {
  if (!answersNow(pick.activity)) return store.addToPlan(pick) ? "planned" : "full";
  const reply = await store.send({ type: "activity/now", activity: pick.activity, param: pick.param });
  return reply?.ok === true ? "answered" : "refused";
}
