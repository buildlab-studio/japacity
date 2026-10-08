// The contract gate: docs/rules/route-gates.md R-CONTRACT-001 to 004. Not
// built yet: the agent step is named, applying is held back, and the decision
// reads no term (R-CONTRACT-003).
import type { Gate } from "./gate";
import { NO_TERM } from "./gate";

export const contractGate: Gate = {
  gate: "contract",
  steps: ["sponsor"],
  initial: () => ({ gate: "contract", agent: null }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: NO_TERM, override: null, bans: false }),
};
