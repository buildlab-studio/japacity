// The early win (guide:early-win-in-three-turns): a report line of tone good
// that follows from the player's own choice. The client's ask gate
// (guide:nothing-asked-before-early-win), the nightly count (analytics:day-one-and-seven-return) and the first-session
// test read this one definition.
import type { Command, Id, ReportLine, SlotPick } from "../engine/types";

/** Pay from a job or a gig, as the activity and as the ledger tell it, and the job the sure first hunt lands, the good line guide:early-win-in-three-turns makes certain. */
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

/** A route heard, or read on the official page. */
const HEARD = new Set(["line.route.heard", "line.route.looked-into"]);
const REST: Id<"activity"> = "activity.rest";

/** A command with or without the version it is based on. */
type Sent = Command extends infer C ? (C extends { basedOn: number } ? Omit<C, "basedOn"> : never) : never;

/**
 * What the player chose that a command's lines follow from: a month's slots, or a now-act. Null for any other command:
 * the command is the choice itself, with no slots to read.
 */
export function picksOf(command: Sent): SlotPick[] | null {
  if (command.type === "turn/end") return command.slots;
  if (command.type === "activity/now") return [{ activity: command.activity, param: command.param }];
  return null;
}

/**
 * True when the line is an early win. `picks` are what the player chose for the lines (`picksOf`), or null when no
 * slots stand behind them or they are not known (the prologue's preset, the authority's own lines): a route heard or
 * read in a month with no pick but rest came from the news, not a choice, and otherwise counts.
 */
export function isEarlyWin(line: ReportLine, picks: readonly SlotPick[] | null): boolean {
  if (line.tone !== "good") return false;
  if (PAY.has(line.key) || MET.has(line.key)) return true;
  if (!HEARD.has(line.key)) return false;
  return picks === null || picks.some((pick) => pick.activity !== REST);
}

/** The first early win among the lines, or null. */
export function earlyWinIn(lines: readonly ReportLine[], picks: readonly SlotPick[] | null): ReportLine | null {
  return lines.find((line) => isEarlyWin(line, picks)) ?? null;
}
