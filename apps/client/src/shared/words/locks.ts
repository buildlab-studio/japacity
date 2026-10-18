// A slot lock as the player reads it: how many slots, why, and for how long
// (turn:slots-can-be-locked, health:view-shows-health-warning). A lock's `untilMonth` is the last month it holds,
// counted as the view counts months, so the month in hand is one month left.
import type { SlotLock } from "@japacity/sim";

import { playerMonth } from "./format";
import { hasWords, say, sayCount } from "./text";

/** The reason a side job holds its slot: renewed each month it is kept (activity:side-job-holds-a-slot). */
export const SIDE_JOB_LOCK = "side-job";

/** Months a lock still holds, counting the month in hand. */
function lockMonthsLeft(lock: SlotLock, month: number): number {
  return Math.max(1, lock.untilMonth - month + 1);
}

/** Content's reason as words, or the plain fallback for a reason the interface has no words for. */
function lockReason(why: string): string {
  return say(hasWords(`ui.locks.why.${why}`) ? `ui.locks.why.${why}` : "ui.locks.why.other");
}

/** One lock as a sentence: "1 slot held by illness, 2 months left, to month 14". */
export function lockWords(lock: SlotLock, month: number): string {
  const slots = sayCount("ui.offer.lock.slots", lock.slots, { count: lock.slots });
  const why = lockReason(lock.why);
  if (lock.why === SIDE_JOB_LOCK) return say("ui.locks.side", { slots, why });
  const left = lockMonthsLeft(lock, month);
  return say("ui.locks.item", { slots, why, left: sayCount("ui.locks.left", left, { count: left, month: playerMonth(lock.untilMonth) }) });
}
