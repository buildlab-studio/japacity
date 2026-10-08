// The nudge line's choice (docs/rules/world.md R-WORLD-003): one thing to notice, from the view, in
// this order: an open set piece or interview question; an open offer; the chapter's next undone step
// in its own nudge words; a report line waiting on the player; else the month's end.
import type { PlayerView } from "@japacity/sim";

import { asksAttention, tidyLines } from "../../shared/words/lines";
import { hasWords } from "../../shared/words/text";
import type { Nudge } from "../../shared/world/contract";

/** What the nudge points at, so a tap on it can open the matching sheet. */
export type NudgeAbout = "setpiece" | "offer" | "step" | "report" | "end";

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
