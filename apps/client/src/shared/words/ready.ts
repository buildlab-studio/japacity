// How ready the character is to go, one figure for Japa and the data page (docs/rules/world.md R-WORLD-019; the
// The japacity figure, else the plan's own
// figure while no route's figure counts yet (care work, shut to applicants from abroad, reads from the month its page
// is read, as the master's does: R-CHAPTER-009).
import type { PlayerView } from "@japacity/sim";

/** The percent ready, or null when nothing counts yet. */
export function readyPercent(view: Pick<PlayerView, "japacity" | "plan" | "routes">): number | null {
  if (view.japacity.percent !== null) return view.japacity.percent;
  const lean = view.plan.route;
  return lean === null ? null : (view.routes.find((route) => route.id === lean)?.percent ?? null);
}
