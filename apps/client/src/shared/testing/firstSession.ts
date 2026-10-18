// The first session's next step as the client reads it (R-GUIDE-014): the simulation's
// first session plays it through `nextStep`.
import type { Id, Requirement } from "@japacity/sim";
import { chapterPicks, type NextStep } from "@japacity/sim/testing";

import { ownRouteOf } from "../words/sixteen";

/**
 * The view has no `nextStep` for a life at home (only the status abroad carries one), so the
 * next step is read from the current chapter: one pick for each unmet item an activity can serve,
 * in the chapter's order, then rest. An item met by any route of the player's own effort (the first
 * chapter's heard and known) tries the life's own way out first (R-CHAPTER-009), then the page's order.
 */
export const chapterNextStep: NextStep = (view, content) =>
  chapterPicks(view, content, (ways) => {
    const own: Id<"route"> | null = ownRouteOf(view);
    const isOwn = (way: Requirement) => Number(way.type === "route/state" && way.route === own);
    return [...ways].sort((left, right) => isOwn(right) - isOwn(left));
  });
