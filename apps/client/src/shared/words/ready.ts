// How ready the character is to go, one figure for Japa and the data page (docs/rules/world.md R-WORLD-019; the
// The japacity figure, else the plan's own
// figure while no route's figure counts yet (care work, shut to applicants from abroad, reads from the month its page
// is read, as the master's does: R-CHAPTER-009).
import type { PlayerView } from "@japacity/sim";

import { say } from "./text";

/** The percent ready, or null when nothing counts yet. */
export function readyPercent(view: Pick<PlayerView, "japacity" | "plan" | "routes">): number | null {
  if (view.japacity.percent !== null) return view.japacity.percent;
  const lean = view.plan.route;
  return lean === null ? null : (view.routes.find((route) => route.id === lean)?.percent ?? null);
}

/**
 * How ready, in words, for the data page: the figure's quarter, and All set at a hundred, never a percentage (the words pass
 * of 13 Oct 2026; the shared rules: no percentage a player reads). Japa draws the same figure as a bar.
 */
export function readyWords(percent: number): string {
  const band = percent >= 100 ? 4 : Math.min(3, Math.max(0, Math.floor(percent / 25)));
  return say(`prologue.page.ready.band.${String(band)}`);
}
