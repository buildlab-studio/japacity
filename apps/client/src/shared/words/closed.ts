// A way out closed by the news (docs/rules/route.md R-ROUTE-005; docs/rules/world.md R-WORLD-003,
// R-WORLD-019): the nudge and Japa read one test of it, so they never disagree on whether every route is shut.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

/** True when every route with a window is closed in the view: the pandemic closes them all at once (news.pandemic-borders). */
export function everyRouteClosed(view: Partial<Pick<PlayerView, "routes">>): boolean {
  const windowed = (view.routes ?? []).filter((route) => (content.route[route.id]?.window ?? null) !== null);
  return windowed.length > 0 && windowed.every((route) => route.window === "closed");
}
