import type { Id } from "../engine/types";

export type GoalEvent =
  /** The goal's `openIf` held, or an effect opened it (R-GOAL-001). */
  | { type: "goal/opened"; goal: Id<"goal">; month: number }
  /** The goal's `doneIf` held while it was open, or an effect finished it. It stays done (R-GOAL-002). */
  | { type: "goal/done"; goal: Id<"goal">; month: number };
