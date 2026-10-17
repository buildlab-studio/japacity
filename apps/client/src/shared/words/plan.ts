// The plan's dated waits (docs/rules/chapter.md R-CHAPTER-009): a school's
// answer due, the points profile running out, the endorsement's wait ending. In shared/ so the Japa app and
// the city's Coming up both read them without one feature importing another.
import type { PlayerView } from "@japacity/sim";

import { nameOf, say } from "./text";

export interface PlanMark {
  /** The words key of what waits, from content. */
  key: string;
  what: string;
  /** The month it comes, in the simulation's count; said as months away. */
  month: number;
}

/**
 * The plan's marks (R-CHAPTER-009): what waits on a date for the plan's way, soonest first: a school's
 * answer, the points profile running out, the day the endorsement may be asked for again.
 */
export function planMarks(view: Pick<PlayerView, "routes" | "plan" | "month">): PlanMark[] {
  const route = view.routes.find((held) => held.id === view.plan.route);
  if (route === undefined) return [];
  const marks: PlanMark[] = [];
  const mark = (key: string, month: number | null, params: Record<string, string> = {}) => {
    if (month !== null && month >= view.month) marks.push({ key, what: say(key, params), month });
  };
  for (const school of route.schools) if (school.state === "pending") mark("route.plan.mark.school", school.readyMonth, { school: nameOf(school.id) });
  if (route.gate?.gate === "points" && route.gate.invitedMonth === null) mark("route.plan.mark.pool", route.gate.profileEndsMonth);
  if (route.gate?.gate === "endorsement" && route.gate.cooledFromMonth !== null && route.gate.cooledFromMonth > view.month) mark("route.plan.mark.endorsement", route.gate.cooledFromMonth);
  return marks.sort((a, b) => a.month - b.month);
}

