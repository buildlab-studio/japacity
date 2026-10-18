// The commitments that carry on (docs/rules/world.md R-WORLD-007): a month-act started carries on into the next month
// until it is stopped or ends itself. The store reads it as each month turns; a plain function over the plan and the
// view, so the carry is the same wherever it is read.
import { content } from "@japacity/content";
import type { PlayerView, SlotPick } from "@japacity/sim";

import { plannable } from "../words/acts";

const HUNT = "activity.job-hunt";

/** A hunt for a job the character already holds: last month's search, done now that it paid off. */
function huntsHeldJob(pick: SlotPick | null, job: PlayerView["job"]): boolean {
  return pick !== null && pick.activity === HUNT && pick.param !== null && (pick.param === job.id || pick.param === job.side);
}

/** True for an act whose entry is an exam: one sitting, never carried into the next month (R-WORLD-007, R-ACTIVITY-013). */
function sitsAnExam(pick: SlotPick): boolean {
  return content.activity[pick.activity]?.exam !== undefined;
}

/** True when the view still lets this pick be planned: allowed, paid for, and its param still on offer. */
function stillOpen(view: Pick<PlayerView, "activities">, pick: SlotPick): boolean {
  const option = view.activities.find((entry) => entry.id === pick.activity);
  if (option === undefined || !option.allowed || !option.affordable) return false;
  return option.params === null || pick.param === null || option.params.includes(pick.param);
}

/**
 * R-WORLD-007: commitments, not a plan each month. A month-act the player
 * started carries on into the next month until it is stopped, or until it ends itself: the view no longer allows it
 * or it can no longer be paid (a course finished, a way shut), or it was the search for a job now held. A now-act is
 * never carried, nor rest, which an empty slot already is. The free time the life has is the limit (R-TURN-006).
 * An exam is one sitting: an act with an exam on its entry leaves
 * the plan the month it runs, pass or fail, so a failed exam is sat again, and paid again, only by a new tap on its card.
 */
export function carriedPlan(plan: readonly (SlotPick | null)[], view: Pick<PlayerView, "freeSlots" | "job" | "activities">): SlotPick[] {
  return plan
    .filter((pick): pick is SlotPick => pick !== null && plannable(pick.activity) && !sitsAnExam(pick))
    .filter((pick) => !huntsHeldJob(pick, view.job) && stillOpen(view, pick))
    .slice(0, view.freeSlots);
}
