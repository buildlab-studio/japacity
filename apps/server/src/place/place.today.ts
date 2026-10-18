// city:players-shown-present-not-tracked, clock:presence-held-in-memory: the day's seen list, the one thing a room keeps in
// its storage. Names and looks only. Plain functions, so the router and the
// Node tests import them without the Workers runtime.
import { xorshift32 } from "@japacity/store";
import { int, time } from "@japacity/sim";

/** Who was seen today: never an account id, never a position. */
export interface Seen {
  name: string;
  look: string;
}

/** The list as stored: the Lagos day it is for, oldest first. */
export interface TodayList {
  day: number;
  seen: Seen[];
}

/** The room's one storage key. */
export const TODAY_KEY = "today";

/** clock:december-by-lagos-time: Lagos keeps UTC+1 all year. */
const LAGOS_OFFSET_MS = time.HOUR_MS;

/** The Lagos day of a moment, as whole days since 1970. */
export function lagosDay(ms: number): number {
  return int.divFloor(ms + LAGOS_OFFSET_MS, time.DAY_MS);
}

function same(one: Seen, other: Seen): boolean {
  return one.name === other.name && one.look === other.look;
}

/** The day's entries, or none when the stored list is another day's. */
export function listOn(stored: TodayList | undefined, day: number): Seen[] {
  return stored?.day === day ? stored.seen : [];
}

/** Adds one entry as the newest, once per name and look, keeping the newest `max`. A later day's list is kept as it is. */
export function recordSeen(stored: TodayList | undefined, day: number, seen: Seen, max: number): TodayList {
  if (stored !== undefined && stored.day > day) return stored;
  const kept = listOn(stored, day).filter((each) => !same(each, seen));
  const all = [...kept, { name: seen.name, look: seen.look }];
  return { day, seen: all.slice(Math.max(0, all.length - max)) };
}

/** Reads what storage gave back, or undefined for anything that is not a list. */
export function parseTodayList(value: unknown): TodayList | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const held = value as Record<string, unknown>;
  if (typeof held.day !== "number" || !Array.isArray(held.seen)) return undefined;
  const seen: Seen[] = [];
  for (const entry of held.seen as unknown[]) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const { name, look } = entry as Record<string, unknown>;
    if (typeof name !== "string" || typeof look !== "string") return undefined;
    seen.push({ name, look });
  }
  return { day: held.day, seen };
}

/** clock:presence-is-a-sample: at most `n` of the day's list, none of them here now, drawn afresh by the seed. */
export function drawToday(seen: readonly Seen[], here: readonly Seen[], n: number, seed: number): Seen[] {
  const pool = seen.filter((each) => !here.some((member) => same(member, each))).map((each) => ({ name: each.name, look: each.look }));
  const next = xorshift32(seed);
  for (let index = pool.length - 1; index > 0; index--) {
    const other = next() % (index + 1);
    const held = pool[index];
    const swapped = pool[other];
    if (held === undefined || swapped === undefined) continue;
    pool[index] = swapped;
    pool[other] = held;
  }
  return pool.slice(0, Math.max(0, n));
}
