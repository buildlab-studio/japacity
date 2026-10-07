// Life goals: docs/rules/goal.md. Stub: none open.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { GoalSlice } from "../engine/types";
import type { GoalEvent } from "./goal.events";

export const goalKind: RegisteredKind<GoalSlice, GoalEvent> = {
  kind: "goal",
  initial: () => ({ open: {}, done: {} }),
  effects: effectsNotBuilt(["goal/open", "goal/done"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["goal/done"]),
  view: () => ({ goals: { open: [], done: [] } }),
};
