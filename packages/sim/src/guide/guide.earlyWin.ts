// The early win (guide:early-win-in-three-turns): a report line of tone good
// that follows from the player's own choice. The client's ask gate
// (guide:nothing-asked-before-early-win), the nightly count (analytics:day-one-and-seven-return) and the first-session
// test read this one definition.
import type { Command, Id, ReportLine, SlotPick } from "../engine/types";

/** Pay from a job or a gig, and the job the sure first hunt lands, the good line guide:early-win-in-three-turns makes certain. */
const PAY = new Set([
  "line.activity.salary",
  "line.activity.salary-first-foreign",
  "line.activity.salary-first-abroad",
  "line.activity.side-pay",
  "line.activity.gig",
  "line.activity.overtime",
  "line.activity.hunt-hired",
]);

/** A chapter or a goal met. */
const MET = new Set(["line.chapter.closed", "line.goal.done"]);

const HEARD = "line.route.heard";
const REST: Id<"activity"> = "activity.rest";

/** A command with or without the version it is based on. */
type Sent = Command extends infer C ? (C extends { basedOn: number } ? Omit<C, "basedOn"> : never) : never;

/** What the player chose that a command's lines follow from: a month's slots, or a now-act. */
export function picksOf(command: Sent): SlotPick[] {
  if (command.type === "turn/end") return command.slots;
  if (command.type === "activity/now") return [{ activity: command.activity, param: command.param }];
  return [];
}

/**
 * True when the line is an early win. `picks` are what the player chose for the
 * lines (`picksOf`): a route heard in a month with no pick but rest came from
 * the news, not a choice.
 */
export function isEarlyWin(line: ReportLine, picks: readonly SlotPick[]): boolean {
  if (line.tone !== "good") return false;
  if (PAY.has(line.key) || MET.has(line.key)) return true;
  return line.key === HEARD && picks.some((pick) => pick.activity !== REST);
}

/** The first early win among the lines, or null. */
export function earlyWinIn(lines: readonly ReportLine[], picks: readonly SlotPick[]): ReportLine | null {
  return lines.find((line) => isEarlyWin(line, picks)) ?? null;
}
