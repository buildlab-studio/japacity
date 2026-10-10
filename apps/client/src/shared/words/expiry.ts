// When a held paper runs out. A paper is valid while the month is below its
// expiry month (docs/rules/document.md), so the months left count this one.
import type { PlayerView } from "@japacity/sim";

type Paper = PlayerView["documents"][number];

/** How close an expiry must be before the screen warns. */
export const SOON = 2;

/**
 * Months a held paper has left, counting this one, or null when it does not run out, is not held, or a new copy
 * is on its way (docs/rules/document.md R-DOCUMENT-008): a licence being renewed is not about to run out.
 */
export function monthsLeft(paper: Paper, month: number): number | null {
  if (paper.state !== "held" || paper.expiresMonth === null || paper.onItsWay !== null) return null;
  return Math.max(0, paper.expiresMonth - month);
}

/** Held papers that run out within SOON months, soonest first. */
export function expiringSoon(view: Pick<PlayerView, "documents" | "month">): { paper: Paper; left: number }[] {
  return view.documents
    .map((paper) => ({ paper, left: monthsLeft(paper, view.month) }))
    .filter((entry): entry is { paper: Paper; left: number } => entry.left !== null && entry.left > 0 && entry.left <= SOON)
    .sort((a, b) => a.left - b.left);
}
