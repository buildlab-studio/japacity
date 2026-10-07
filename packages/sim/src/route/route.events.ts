import type { Id, RouteStateName } from "../engine/types";

/** Placeholder: the route work defines the real events. */
export type RouteEvent = { type: "route/moved"; route: Id<"route">; to: RouteStateName };
