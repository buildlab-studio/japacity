// Acts that answer in the place (docs/rules/activity.md R-ACTIVITY-015): the place answers a now-act in a person's
// voice, with Done to close, and a now-act done this month leaves its thing until the next. The card's button itself is
// `actOnCard` in shared/words/acts.ts, which the picker and the phone use too.
import type { PlayerView, ReportLine } from "@japacity/sim";

import { nowActOf, nowLineWords } from "../../shared/words/acts";
import { nameOf, say } from "../../shared/words/text";
import type { Ask } from "../../shared/world/contract";

/** The paper things bought at the kiosk: their slip stays in the hand with the answer on it. */
const PAPER: ReadonlySet<string> = new Set(["activity.play-lotto", "activity.bet-slip"]);

/** True when the act's sheet is a paper slip (a ticket, a bet), not a card. */
export function isPaper(activity: string): boolean {
  return PAPER.has(activity);
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
 * The activities a place's things may offer now (R-WORLD-005): those the view allows; one shut only by a paper not
 * yet held, or a way to ask about a route, which still stands with its reason; and the hunt's board with its jobs, which stays while a job is held.
 * A now-act done this month is not allowed again, and the board goes with the hunt asked this month: the thing's
 * chip shows the act again next month, not this one (R-ACTIVITY-015).
 */
export function actsOffered(view: Pick<PlayerView, "activities">): string[] {
  const paperShut = view.activities.filter((option) => !option.allowed && !option.done && option.missing.length > 0 && (option.missing.every((need) => need.type === "document/held") || STANDS_SHUT.has(option.id))).map((option) => option.id);
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  const board = hunt === undefined || hunt.done ? [] : [hunt.id, ...(hunt.params ?? [])];
  return [...new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...paperShut, ...board])];
}

/**
 * True when a shut card says why itself (R-ADVICE-001, R-WORLD-006): its "Not yet:" list, or
 * the sentence that there is nothing to choose yet ("No route to look into yet"). The reason is said once, there; the
 * button is shut and says only "Not yet". A card whose needs are all done already says that instead.
 */
export function saysWhyOnCard(option: Pick<PlayerView["activities"][number], "allowed" | "missing" | "params">, done: (requirement: PlayerView["activities"][number]["missing"][number]) => boolean): boolean {
  if (option.allowed) return false;
  if (option.missing.length > 0) return !option.missing.every(done);
  return option.params?.length === 0;
}
