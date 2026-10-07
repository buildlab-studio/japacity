// Japacity: docs/rules/japacity.md. Derived, never stored.
// Stub: the japacity work replaces both bodies.
import type { Id, ReadCtx } from "../engine/types";

/** One route's figure, 0 to 100, or null when it has none (R-JAPACITY-001, 002, 005). */
export function routePercent(_read: ReadCtx, _route: Id<"route">): number | null {
  return null;
}

/** The character's japacity: the best figure among the routes that count (R-JAPACITY-003). */
export function japacity(_read: ReadCtx): { percent: number | null; route: Id<"route"> | null } {
  return { percent: null, route: null };
}
