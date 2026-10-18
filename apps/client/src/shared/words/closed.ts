// A way out closed by the news (route:closed-window-blocks-applying; world:nudge-says-one-thing,
// world:phone-holds-what-phones-hold): the nudge and Japa read one test of it, so they never disagree on whether every route is shut.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

/** True when every route with a window is closed in the view: the pandemic closes them all at once (news.pandemic-borders). */
export function everyRouteClosed(view: Partial<Pick<PlayerView, "routes">>): boolean {
  const windowed = (view.routes ?? []).filter((route) => (content.route[route.id]?.window ?? null) !== null);
  return windowed.length > 0 && windowed.every((route) => route.window === "closed");
}
