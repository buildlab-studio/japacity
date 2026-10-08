// The sponsor gate: docs/rules/route-gates.md R-SPONSOR-001 to 007. Not built
// yet: the steps are named, applying is held back, and the decision reads
// strictness, earlier refusals and the good grade (R-SPONSOR-004).
import type { Gate } from "./gate";

export const sponsorGate: Gate = {
  gate: "sponsor",
  steps: ["sponsor", "salary"],
  initial: () => ({ gate: "sponsor", sponsor: null }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: { strictness: true, unexplained: false, refusals: true, interview: false, goodGrade: true }, override: null, bans: false }),
  // Recording a sponsor from an offer is the gate's first step (R-SPONSOR-002). Until it is built the record is dropped.
  effects: { "route/record-sponsor": () => [] },
};
