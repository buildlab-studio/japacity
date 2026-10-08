// The points gate: docs/rules/route-gates.md R-POINTS-001 to 005. Not built
// yet: the steps are named, applying is held back, and the decision reads the
// unexplained share and earlier refusals (R-POINTS-004).
import type { Gate } from "./gate";

export const pointsGate: Gate = {
  gate: "points",
  steps: ["pool", "invited"],
  initial: () => ({ gate: "points", poolMonth: null, invitedMonth: null }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: { strictness: false, unexplained: true, refusals: true, interview: false, goodGrade: false }, override: null, bans: false }),
};
