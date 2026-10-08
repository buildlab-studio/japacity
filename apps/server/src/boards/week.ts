// The Lagos week (docs/rules/clock.md R-CLOCK-014, city.md R-CITY-039): Lagos
// keeps UTC+1 all year, and a week begins on Monday at 00:00 there.
import { int, time } from "@japacity/sim";

const LAGOS_OFFSET_MS = time.HOUR_MS;
const WEEK_DAYS = 7;
/** 1 January 1970 was a Thursday: three days after a Monday. */
const MONDAY_OFFSET = 3;

/** R-CITY-039: the Lagos week of a moment, as whole weeks since the Monday before 1970. */
export function lagosWeek(ms: number): number {
  return int.divFloor(int.divFloor(ms + LAGOS_OFFSET_MS, time.DAY_MS) + MONDAY_OFFSET, WEEK_DAYS);
}

/** When a Lagos week begins, in milliseconds since 1970. */
export function weekBeginsAt(week: number): number {
  return (week * WEEK_DAYS - MONDAY_OFFSET) * time.DAY_MS - LAGOS_OFFSET_MS;
}
