// Acts that answer in the place (docs/rules/activity.md R-ACTIVITY-015): the place answers a now-act in a person's
// voice, with Done to close, and a now-act done this month leaves its thing until the next. The card's button itself is
// `actOnCard` in shared/words/acts.ts, which the picker and the phone use too.
import { content } from "@japacity/content";
import type { Id, PlayerView, ReportLine, SlotPick } from "@japacity/sim";

import { plannedShut } from "../../authority/store";
import { nowActOf, nowLineWords, pickable } from "../../shared/words/acts";
import { kioskCapReached } from "../../shared/words/lotto";
import { nameOf, say } from "../../shared/words/text";
import type { Ask, Thing } from "../../shared/world/contract";

/** The paper things bought at the kiosk: their slip stays in the hand with the answer on it. */
const PAPER: ReadonlySet<string> = new Set(["activity.play-lotto", "activity.bet-slip"]);

/** True when the act's sheet is a paper slip (a ticket, a bet), not a card. */
export function isPaper(activity: string): boolean {
  return PAPER.has(activity);
}

/** The kiosk's answer to a ticket bought, and the line it says once the month's ceiling is reached (R-LUCK-005). */
const KIOSK_NOW = "line.activity.play-lotto.now";
export const KIOSK_CAP = "line.activity.play-lotto.cap";

/**
 * The kiosk's answer as the month stands (R-LUCK-005): once this month's tickets reach the
 * most one slip sells, the kiosk says so in its own voice in place of "Ticket bought". Any other answer is as it came.
 */
export function kioskAnswer(line: ReportLine, monthLines: readonly ReportLine[]): ReportLine {
  return line.key === KIOSK_NOW && kioskCapReached(monthLines) ? { ...line, key: KIOSK_CAP } : line;
}

/**
 * The place's answer as its sheet (R-ACTIVITY-015, R-WORLD-006): the act's name, the now-line in the speaker's words,
 * a paper bought kept as its slip, nothing more to pay, and one button, Done, that closes it.
 */
export function answerAsk(line: ReportLine, where: { who: string; clock: string }, close: () => void): Ask {
  const activity = nowActOf(line);
  const paper = isPaper(activity);
  return {
    form: paper ? "slip" : "card",
    icon: paper ? "ticket" : "hand",
    who: where.who,
    title: nameOf(activity),
    line: nowLineWords(line),
    cost: null,
    button: say("ui.world.done"),
    when: "now",
    // A card's button has no second line once the act is done; a slip's button never has one.
    ...(paper ? { reference: where.clock.toUpperCase() } : { note: "" }),
    act: close,
    dismiss: close,
  };
}

/**
 * Ways to ask about a route that stand on their sheet while shut, with the reason: the adviser
 * until a way out is heard of, the word of someone who went until the network reaches one. So "Ask about routes" never
 * opens on a sheet with nothing about routes.
 */
const STANDS_SHUT: ReadonlySet<string> = new Set(["activity.see-adviser", "activity.ask-someone-who-went"]);

/**
 * True when an act is shut only because the job it starts is already held: "Open the shop" while the shop runs. Its
 * thing is the player's own (the stall), a thing of the world, so it stays.
 */
function startedJobHeld(activity: string, need: PlayerView["activities"][number]["missing"][number]): boolean {
  if (need.type !== "not" || need.of.type !== "job/is" || need.of.activities.length !== 1) return false;
  const job = need.of.activities[0];
  return content.activity[activity as Id<"activity">]?.effects.some((effect) => effect.type === "activity/start-job" && effect.job === job) === true;
}

/**
 * The activities a place's things may offer now (R-WORLD-005): those the view allows; one shut only by a paper not
 * yet held, or a way to ask about a route, which still stands with its reason; and the hunt's board with its jobs, which stays while a job is held.
 * A now-act done this month is not allowed again, and the board goes with the hunt asked this month: the thing's
 * chip shows the act again next month, not this one (R-ACTIVITY-015).
 */
export function actsOffered(view: Pick<PlayerView, "activities">): string[] {
  // The act that started the job held stands too: the trader's stall stays in the market once her shop is open (R-ACTIVITY-016).
  const held = view.activities.filter((option) => !option.allowed && option.missing.some((need) => startedJobHeld(option.id, need))).map((option) => option.id);
  const paperShut = view.activities.filter((option) => !option.allowed && !option.done && option.missing.length > 0 && (option.missing.every((need) => need.type === "document/held") || STANDS_SHUT.has(option.id))).map((option) => option.id);
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  const board = hunt === undefined || hunt.done ? [] : [hunt.id, ...(hunt.params ?? [])];
  // R-ACTIVITY-020: an act shut only because the body is spent stays on its thing, which says so where its button was.
  const spent = view.activities.filter((option) => option.spent === true).map((option) => option.id);
  // R-TURN-006: rest is never a thing's act; an empty slot already rests, and the bed's act is to lie down at once.
  return [...new Set([...pickable(view.activities).filter((option) => option.allowed).map((option) => option.id), ...paperShut, ...held, ...board, ...spent])];
}

/**
 * The thing with each act done at once whose body is spent marked (R-ACTIVITY-020): its chip says "You are spent. Sleep."
 * where its button was. A sheet act opens its sheet, which says it in place of the main button.
 */
export function withSpent(thing: Thing, view: Pick<PlayerView, "activities">): Thing {
  let marked = false;
  const acts = thing.acts.map((act) => {
    if (act.kind !== "do" || act.stages === undefined) return act;
    if (view.activities.find((option) => option.id === act.stages)?.spent !== true) return act;
    marked = true;
    return { ...act, spent: true };
  });
  return marked ? { ...thing, acts } : thing;
}

/**
 * The thing with each act that carries on in the plan marked (R-WORLD-007): its chip says "Ongoing" with a stop. A sheet
 * act whose choice is made inside its sheet (which job, which route) stays open, since another choice can still be started.
 */
export function withPlanned(thing: Thing, plan: readonly (SlotPick | null)[], view: Pick<PlayerView, "activities">): Thing {
  let marked = false;
  const acts = thing.acts.map((act) => {
    if ((act.kind !== "do" && act.kind !== "sheet") || act.stages === undefined || act.more !== undefined) return act;
    const entry = content.activity[act.stages as Id<"activity">];
    if (entry === undefined) return act;
    const option = view.activities.find((candidate) => candidate.id === act.stages);
    const param = act.param ?? (act.kind === "do" ? (option?.params?.[0] ?? null) : entry.param === null ? null : undefined);
    if (param === undefined || !plannedShut(plan, { activity: act.stages as Id<"activity">, param })) return act;
    marked = true;
    return { ...act, planned: true };
  });
  return marked ? { ...thing, acts } : thing;
}

/**
 * The asks sheet's header (R-WORLD-006): with several asks waiting, which one this is of those still waiting, so the
 * count is what is left; over a set piece of several
 * questions (the exam), which of its own questions this is, never "3 of 3" over its first question once the other asks
 * are answered. Null with one ask left and nothing to count.
 */
export function askHeader(at: { left: number; index: number; setpiece: Pick<NonNullable<PlayerView["setpiece"]>, "asked" | "total"> | null }): { n: number; count: number } | null {
  if (at.setpiece !== null && at.setpiece.total > 1) return { n: Math.min(at.setpiece.asked + 1, at.setpiece.total), count: at.setpiece.total };
  if (at.left < 2) return null;
  return { n: Math.min(at.index, at.left - 1) + 1, count: at.left };
}
