// The nudge line's choice (docs/rules/world.md R-WORLD-003): one thing to notice, from the view, in
// this order: an open set piece or interview question; an open offer; the chapter's next undone step
// in its own nudge words; a report line waiting on the player; else the month's end.
import type { PlayerView } from "@japacity/sim";

import { asksAttention, tidyLines } from "../../shared/words/lines";
import { hasWords } from "../../shared/words/text";
import type { Nudge } from "../../shared/world/contract";

/** What the nudge points at, so a tap on it can open the matching sheet. */
export type NudgeAbout = "setpiece" | "offer" | "step" | "report" | "end";

/**
 * Where a chapter's step is done (R-WORLD-003): the things that move it, as `<place>:<thing>` in
 * the order to prefer when more than one stands in the place, and the stop to ride to when none
 * does. `go` null: the step is done by ending the month.
 */
export interface StepWay {
  go: string | null;
  at: readonly string[];
}

const HUB_DESK: StepWay = { go: "place.ojuelegba", at: ["place.yaba:desk", "place.ojuelegba:hub"] };
const PAPERS: StepWay = { go: "place.family-house", at: ["place.family-house:papers-box", "place.family-house:house"] };
const MONTH_END: StepWay = { go: null, at: [] };

const STEP_WAYS: Record<string, StepWay> = {
  "chapter.find-your-feet.job": { go: "place.ojuelegba", at: ["place.yaba:jobs", "place.ojuelegba:hub"] },
  "chapter.find-your-feet.pay": MONTH_END,
  "chapter.find-your-feet.heard": { go: "place.ojuelegba", at: ["place.yaba:meetup", "place.ojuelegba:hub"] },
  "chapter.find-your-feet.known": HUB_DESK,
  "chapter.build-the-file.passport": PAPERS,
  "chapter.build-the-file.transcript": PAPERS,
  "chapter.build-the-file.english": { go: "place.english-test-centre", at: ["place.english-test-centre:desk"] },
  "chapter.build-the-file.offer": HUB_DESK,
  "chapter.decision-day.deposit": { go: "place.olokun-office", at: ["place.olokun-office:counter"] },
  "chapter.decision-day.held": MONTH_END,
  "chapter.decision-day.tb": { go: "place.tb-clinic", at: ["place.tb-clinic:desk"] },
  "chapter.decision-day.applied": { go: "place.visa-centre", at: ["place.visa-centre:desk"] },
  "chapter.decision-day.granted": MONTH_END,
  "chapter.send-off.departed": { go: "place.airport-lagos", at: ["place.airport-lagos:gate"] },
};

/** The way to the chapter's next undone step, or null when the step has no place in the world (life abroad). */
export function stepWayOf(chapter: PlayerView["chapter"]): StepWay | null {
  const step = chapter.items.find((item) => !item.met)?.id ?? null;
  if (chapter.current === null || step === null) return null;
  return STEP_WAYS[`${chapter.current}.${step}`] ?? null;
}

/** The thing in `here` that the step's way names, the first of its order that stands among `things`. */
export function stepThingHere(way: StepWay, here: string | null, things: readonly { id: string }[]): string | null {
  for (const entry of way.at) {
    const [place, thing] = entry.split(":");
    if (place === here && things.some((candidate) => candidate.id === thing)) return thing ?? null;
  }
  return null;
}

/** `has`: whether words exist for a key; content's and the interface's tables unless a test says otherwise. */
export function nudgeOf(view: Pick<PlayerView, "setpiece" | "interview" | "offers" | "chapter" | "report">, has: (key: string) => boolean = hasWords): Nudge & { about: NudgeAbout } {
  if (view.setpiece !== null || (view.interview?.question ?? null) !== null) return { key: "ui.nudge.setpiece", about: "setpiece" };
  if (view.offers.length > 0) return { key: "ui.nudge.offer", about: "offer" };
  const step = view.chapter.items.find((item) => !item.met)?.id ?? null;
  if (view.chapter.current !== null && step !== null) {
    // The story's own nudge words for the step when content has them (at most eight words), else the step's words.
    const own = `${view.chapter.current}.item.${step}`;
    return { key: has(`${own}.nudge`) ? `${own}.nudge` : own, about: "step" };
  }
  // A report line waits when one of last month's lines asks for the player.
  if (view.report !== null && tidyLines(view.report.lines).some(asksAttention)) return { key: "ui.nudge.report", about: "report" };
  return { key: "ui.nudge.end", about: "end" };
}
