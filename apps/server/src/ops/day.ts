import { int, time } from "@japacity/sim";

/** R-SERVER-011: a UTC day as a whole number of days since 1970. */
export function utcDay(ms: number): number {
  return int.divFloor(ms, time.DAY_MS);
}

/** The first millisecond of a UTC day. */
export function dayStart(day: number): number {
  return day * time.DAY_MS;
}
