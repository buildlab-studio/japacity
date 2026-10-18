// analytics:dashboard-shows-fixed-list, analytics:small-counts-shown-as-fewer and analytics:day-one-and-seven-return: the dashboard's data, for the day asked and the 30
// before it. A figure under `minShown` is never shown as itself (analytics:small-counts-shown-as-fewer).
import type { DailyRow, Dashboard, Shown, WeekRow } from "@japacity/api";
import type { Content } from "@japacity/sim";
import { int, time } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";

/** analytics:dashboard-shows-fixed-list: today and the last 30 days. */
export const WINDOW_DAYS = 30;

const WEEK_DAYS = 7;
/** 1 January 1970 was a Thursday: three days after a Monday. */
const MONDAY_OFFSET = 3;

export function shown(count: number, minShown: number): Shown {
  return count < minShown ? { fewerThan: minShown } : count;
}

function sum(rows: readonly CounterTotal[], test: (row: CounterTotal) => boolean): number {
  return rows.filter(test).reduce((total, row) => total + row.count, 0);
}

const weekOf = (day: number) => day - ((day + MONDAY_OFFSET) % WEEK_DAYS);

function rate(part: number, whole: number, minShown: number): number | null {
  return whole < minShown || part < minShown ? null : int.mulDiv(part, 10000, whole);
}

/** The dashboard over the totals of the window that ends on `day`. */
export function dashboard(content: Content, day: string, totals: readonly CounterTotal[]): Dashboard {
  const { minShown, refD1Bp, refD7Bp } = content.tuning.analytics;
  const last = time.dayNumber(day) ?? 0;
  const first = last - WINDOW_DAYS;

  const daily: DailyRow[] = [];
  for (let each = first; each <= last; each += 1) {
    const name = time.dayName(each);
    const ofDay = totals.filter((row) => row.day === name);
    daily.push({
      day: name,
      players: shown(sum(ofDay, (row) => row.name === "players/active"), minShown),
      newPlayers: shown(sum(ofDay, (row) => row.name === "players/new"), minShown),
      turnsEnded: shown(sum(ofDay, (row) => row.name === "turns/ended"), minShown),
    });
  }

  const weeks: WeekRow[] = [];
  for (let week = weekOf(first); week <= last; week += WEEK_DAYS) {
    const names = new Set(Array.from({ length: WEEK_DAYS }, (_, offset) => time.dayName(week + offset)));
    const ofWeek = totals.filter((row) => names.has(row.day));
    const newPlayers = sum(ofWeek, (row) => row.name === "players/new");
    const d1 = sum(ofWeek, (row) => row.name === "players/returned" && row.key === "d1");
    const d7 = sum(ofWeek, (row) => row.name === "players/returned" && row.key === "d7");
    const earlyWin: Record<string, Shown> = {};
    for (const key of ["1", "2", "3", "later", "none"]) earlyWin[key] = shown(sum(ofWeek, (row) => row.name === "first/early-win" && row.key === key), minShown);
    weeks.push({ week: time.dayName(week), newPlayers: shown(newPlayers, minShown), d1: shown(d1, minShown), d7: shown(d7, minShown), d1Bp: rate(d1, newPlayers, minShown), d7Bp: rate(d7, newPlayers, minShown), earlyWin });
  }

  return {
    day,
    from: time.dayName(first),
    minShown,
    reference: { d1Bp: refD1Bp, d7Bp: refD7Bp },
    // A fault is shown whatever its size: it names no one, and one is enough to look.
    askBeforeEarlyWin: totals.some((row) => (row.name === "ask/shown" || row.name === "ask/accepted") && row.key.endsWith(":before") && row.count > 0),
    daily,
    weeks,
    counters: totals.map((row) => ({ ...row, count: shown(row.count, minShown) })),
  };
}
