// Acts that answer in the place (docs/rules/activity.md R-ACTIVITY-015): an entry says when it answers. A now-act's
// card sends it at once and the place answers in a person's voice; a month-act fills a slot of the month.
import { content } from "@japacity/content";
import type { Id, Reply, ReportLine, SlotPick } from "@japacity/sim";

import type { ServerRejection } from "../net/contract";
import { hasWords, words } from "./text";

const NOW_LINE = /^line\.activity\.[a-z0-9-]+\.now$/;

/** True when the entry answers now: its card sends `activity/now`, and it never fills a slot of the month. */
export function answersNow(activity: string): boolean {
  return content.activity[activity as keyof typeof content.activity]?.when === "now";
}

/** The place's answer among a command's lines, `line.activity.<slug>.now`, or null when it holds none. */
export function nowLineIn(lines: readonly ReportLine[]): ReportLine | null {
  return lines.find((line) => NOW_LINE.test(line.key)) ?? null;
}

/** The act a now-line answers, from its params. */
export function nowActOf(line: ReportLine): string {
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
