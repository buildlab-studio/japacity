// The partner gate: docs/rules/people.md R-PEOPLE-026 to 028. Not built yet:
// the people milestone's gates agent fills it. The stub reaches no step, lets
// no application through, and decides with no term.
import type { Gate } from "./gate";
import { NO_TERM } from "./gate";

export const partnerGate: Gate = {
  gate: "partner",
  steps: ["married"],
  initial: () => ({ gate: "partner", bond: null }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: NO_TERM, override: null, bans: false }),
};
