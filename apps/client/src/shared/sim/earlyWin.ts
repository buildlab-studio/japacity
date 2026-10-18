// The early win (R-GUIDE-014): a report line of tone good that follows from the player's
// own choice. Pay from a job or a gig, a chapter or a goal met, a route heard or looked into.
import type { ReportLine, SlotPick } from "@japacity/sim";

/** Pay from a job or a gig, or the job itself landing. */
const PAY = new Set([
  "line.activity.salary",
  "line.activity.salary-first-foreign",
  "line.activity.salary-first-abroad",
  "line.activity.side-pay",
  "line.activity.gig",
  "line.activity.overtime",
  "line.activity.hunt-hired",
  "line.wallet.salary",
]);

/** A chapter or a goal met. */
const MET = new Set(["line.chapter.closed", "line.goal.done"]);

/** A route heard or looked into: the player's own only when the month held something besides rest. */
const HEARD = new Set(["line.route.heard", "line.route.looked-into"]);

const REST = "activity.rest";

/**
 * True when the line is an early win. `slots` are the month's picks when known; a route heard
 * in a month left to rest came from the news, not a choice, so it counts only with a pick.
 */
export function isEarlyWin(line: ReportLine, slots: readonly SlotPick[] | null = null): boolean {
  if (line.tone !== "good") return false;
  if (PAY.has(line.key) || MET.has(line.key)) return true;
  if (!HEARD.has(line.key)) return false;
  return slots === null || slots.some((slot) => slot.activity !== REST);
}

/** The first early win among a month's lines, or null. */
export function earlyWinIn(lines: readonly ReportLine[], slots: readonly SlotPick[] | null = null): ReportLine | null {
  return lines.find((line) => isEarlyWin(line, slots)) ?? null;
}
