// Acts that answer in the place (docs/rules/activity.md R-ACTIVITY-015): a now-act's card sends `activity/now` at once
// and the place answers in a person's voice, with Done to close; a month-act fills a slot of the month, as before.
import type { Id, PlayerView, Reply, ReportLine, SlotPick } from "@japacity/sim";

import type { ServerRejection } from "../../shared/net/contract";
import { answersNow, nowActOf } from "../../shared/words/acts";
import { nameOf, say, words } from "../../shared/words/text";
import type { Ask } from "../../shared/world/contract";

/** What a card's button needs of the game store. */
export interface ActStore {
  send: (command: { type: "activity/now"; activity: Id<"activity">; param: string | null }) => Promise<Reply | ServerRejection | null>;
  addToPlan: (pick: SlotPick) => boolean;
}

export type Acted = "answered" | "refused" | "planned" | "full";

/** A card's main button: a now-act is sent at once and answered in the place; a month-act fills the next free slot. */
export async function actOnCard(pick: SlotPick, store: ActStore): Promise<Acted> {
  if (!answersNow(pick.activity)) return store.addToPlan(pick) ? "planned" : "full";
  const reply = await store.send({ type: "activity/now", activity: pick.activity, param: pick.param });
  return reply?.ok === true ? "answered" : "refused";
}

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
    line: words(line.key, line.params),
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
 * The activities a place's things may offer now (R-WORLD-005): those the view allows; one shut only by a paper not
 * yet held, which still stands with its reason; and the hunt's board with its jobs, which stays while a job is held.
 * A now-act done this month is not allowed again, and the board goes with the hunt asked this month: the thing's
 * chip shows the act again next month, not this one (R-ACTIVITY-015).
 */
export function actsOffered(view: Pick<PlayerView, "activities">): string[] {
  const paperShut = view.activities.filter((option) => !option.allowed && !option.done && option.missing.length > 0 && option.missing.every((need) => need.type === "document/held")).map((option) => option.id);
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  const board = hunt === undefined || hunt.done ? [] : [hunt.id, ...(hunt.params ?? [])];
  return [...new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...paperShut, ...board])];
}
