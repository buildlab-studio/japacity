// The dependant gate: docs/rules/people.md R-PEOPLE-022 to 025. Not built yet:
// the people milestone's gates agent fills it. The stub reaches no step, lets
// no application through, and decides with no term.
import type { Gate } from "./gate";
import { NO_TERM } from "./gate";

export const dependantGate: Gate = {
  gate: "dependant",
  steps: ["joint", "lead"],
  initial: () => ({ gate: "dependant", bond: null }),
  reached: () => false,
  mayApply: () => false,
  decision: () => ({ terms: NO_TERM, override: null, bans: false }),
};
