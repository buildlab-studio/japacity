// What a scheduled tuition has missed and not yet paid (obligation:paying-down-obligations, abroad-money:missed-tuition-runs-in-stages,
// abroad-money:tuition-paid-in-instalments), read from the view's obligation and content's schedule as the fees office counts it: what
// should be paid by the course month in hand, by the schedule or by the plan, less what has been. `obligation/pay` takes exactly this.
import { content } from "@japacity/content";
import { int, type PlayerView } from "@japacity/sim";

type Owed = PlayerView["obligations"][number];

const BP_WHOLE = 10_000;

/** What should have been paid by the end of course month `course`: by the schedule, or on a plan, what was paid before it and the plan's parts. */
function owedBy(owed: Owed, schedule: readonly number[], course: number): number {
  const plan = owed.plan;
  if (plan !== undefined) {
    const before = owed.principal - plan.total;
    const parts = course - plan.month;
    if (parts <= 0) return before;
    return before + (parts >= plan.months ? plan.total : parts * int.divFloor(plan.total, plan.months));
  }
  if (course <= 0) return 0;
  if (course >= schedule.length) return owed.principal;
  return int.mulDiv(owed.principal, schedule.slice(0, course).reduce((sum, part) => sum + part, 0), BP_WHOLE);
}

/** The arrears of a scheduled tuition in the month in hand, in its currency's smallest unit; 0 for any other obligation or none missed. */
export function tuitionArrears(owed: Owed, month: number): number {
  const schedule = content.obligation[owed.entry]?.schedule;
  if (schedule === undefined) return 0;
  return Math.max(0, owedBy(owed, schedule, month - owed.openedMonth) - (owed.principal - owed.outstanding));
}
