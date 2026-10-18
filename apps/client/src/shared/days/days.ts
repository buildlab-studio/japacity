// The days of the month (world:month-passes-as-lived, for the lived month, decision 0011): the day is
// read from the view's `halfDays`, the share of the month's free time spent laid over four weeks; the interface keeps
// no count of its own, so a ride or a plan moves nothing. Each month-act tells of itself in the lines content gives
// it, each in a week of the act counted from the day after it joined the month.
import { activitySignals } from "@japacity/content";
import type { PlayerView, ReportLine, SlotPick } from "@japacity/sim";

const DAYS_IN_WEEK = 7;
/** Four weeks: the days never pass the month. */
export const DAYS_IN_MONTH = 4 * DAYS_IN_WEEK;

export interface MonthDays {
  scenario: string;
  month: number;
  /** Days gone this month, read from the view's time (`dayOfView`): 0 at its start, at most DAYS_IN_MONTH. */
  day: number;
  /** The day each month-act joined the month: the job held from the start, a pick from the day after it was planned. */
  since: Record<string, number>;
  /** The lines already told on the phone this month. */
  told: string[];
}

/** One line of an act, keyed as content keys it, with the week of the act it comes in. */
export interface SignalLine {
  key: string;
  week: number;
}

/** A line due on a day of this month. */
export interface Signal extends SignalLine {
  activity: string;
  day: number;
}

const SIGNAL = /^(activity\.[a-z0-9-]+)\.signal\.(\d+)$/;

/** Each act's lines, in their order. */
const LINES: ReadonlyMap<string, SignalLine[]> = (() => {
  const lines = new Map<string, SignalLine[]>();
  for (const [key, signal] of Object.entries(activitySignals)) {
    const found = SIGNAL.exec(key);
    if (found === null) continue;
    const id = found[1]!;
    lines.set(id, [...(lines.get(id) ?? []), { key, week: signal.week }].sort((left, right) => left.key.localeCompare(right.key)));
  }
  return lines;
})();

/** The lines content gives an act, none for one that answers at once. */
export function signalsOf(activity: string): SignalLine[] {
  return LINES.get(activity) ?? [];
}

/** True for an act that takes the month and tells of itself as it passes. */
export function isMonthAct(activity: string): boolean {
  return LINES.has(activity);
}

/** The month as the view has it, at its first day. */
function freshDays(view: Pick<PlayerView, "scenario" | "month">): MonthDays {
  return { scenario: view.scenario, month: view.month, day: 0, since: {}, told: [] };
}

/** The days kept when they belong to this month of this life; a new month's otherwise (Next month resets them). */
function daysOf(kept: MonthDays | null, view: Pick<PlayerView, "scenario" | "month">): MonthDays {
  return kept !== null && kept.scenario === view.scenario && kept.month === view.month ? kept : freshDays(view);
}

/** The day of the month the view's time says: the share of the month's free time spent, over four weeks, never past it. */
export function dayOfView(view: Pick<PlayerView, "halfDays">): number {
  const { spent, free } = view.halfDays;
  if (free <= 0) return 0;
  return Math.min(DAYS_IN_MONTH, Math.floor((Math.max(0, spent) * DAYS_IN_MONTH) / free));
}

/** The acts that take this month and tell of themselves: the job held, the side job, then what is planned. */
export function monthActs(view: Pick<PlayerView, "job">, plan: readonly (SlotPick | null)[]): string[] {
  const acts = [view.job.id, view.job.side, ...plan.map((pick) => pick?.activity ?? null)].filter((id): id is NonNullable<typeof id> => id !== null && isMonthAct(id));
  return [...new Set<string>(acts)];
}

/** The day of the month a line of an act comes: the act's first day, then a week for each week after. */
function dayOf(since: number, week: number): number {
  return since + 1 + (week - 1) * DAYS_IN_WEEK;
}

/** Every line due by the day the month is at, soonest first. */
export function dueSignals(days: MonthDays, view: Pick<PlayerView, "job">, plan: readonly (SlotPick | null)[]): Signal[] {
  const due: Signal[] = [];
  for (const activity of monthActs(view, plan)) {
    const since = days.since[activity];
    if (since === undefined) continue;
    for (const line of signalsOf(activity)) {
      const day = dayOf(since, line.week);
      if (day <= days.day) due.push({ ...line, activity, day });
    }
  }
  return due.sort((left, right) => left.day - right.day || left.key.localeCompare(right.key));
}

/** The lines due that the phone has not told yet. */
export function waitingSignals(days: MonthDays, view: Pick<PlayerView, "job">, plan: readonly (SlotPick | null)[]): Signal[] {
  return dueSignals(days, view, plan).filter((signal) => !days.told.includes(signal.key));
}

/** What the days are counted from: the view, the plan and the lines of the last command accepted. */
export interface Moment {
  view: PlayerView | null;
  plan: readonly (SlotPick | null)[];
  lines: readonly ReportLine[];
}

/**
 * The days after the store moved from `before` to `after`: the day is the view's (`dayOfView`), so only the time the
 * acts spend moves it. A new month starts at its first day. Every act of the month is given the day it joined.
 */
export function stepDays(kept: MonthDays | null, before: Moment, after: Moment): MonthDays | null {
  if (after.view === null) return kept;
  let days = daysOf(kept, after.view);
  const day = dayOfView(after.view);
  if (day !== days.day) days = { ...days, day };
  const sameMonth = before.view !== null && before.view.scenario === after.view.scenario && before.view.month === after.view.month;
  // The job held from the month's start; anything joining later from the day after its own.
  const first = !sameMonth;
  const since = { ...days.since };
  let changed = false;
  for (const activity of monthActs(after.view, after.plan)) {
    if (since[activity] !== undefined) continue;
    since[activity] = first ? 0 : days.day;
    changed = true;
  }
  return changed ? { ...days, since } : days;
}
