import type { Id } from "../engine/types";

/** Placeholder: the goal agent defines the real events. */
export type GoalEvent = { type: "goal/opened"; goal: Id<"goal">; month: number } | { type: "goal/finished"; goal: Id<"goal">; month: number };
