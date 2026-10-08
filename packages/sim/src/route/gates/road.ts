// The road: docs/rules/road.md. Not built yet. It has no checklist, no
// application and no decision draw; its chain runs in `clocks` once built.
import type { Gate } from "./gate";
import { NO_TERM } from "./gate";

export const roadGate: Gate = {
  gate: "road",
  steps: [],
  initial: () => ({ gate: "road", step: null, monthsHere: 0, debt: 0 }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: NO_TERM, override: null, bans: false }),
  effects: { "route/road-step": () => [] },
};
