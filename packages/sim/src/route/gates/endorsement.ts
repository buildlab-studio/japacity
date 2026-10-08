// The endorsement gate: docs/rules/route-gates.md R-ENDORSE-001 to 003. Not
// built yet: applying is held back, and the decision reads earlier refusals only.
import type { Gate } from "./gate";

export const endorsementGate: Gate = {
  gate: "endorsement",
  steps: [],
  initial: () => ({ gate: "endorsement", endorsementRefusedMonth: null }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: { strictness: false, unexplained: false, refusals: true, interview: false, goodGrade: false }, override: null, bans: false }),
};
