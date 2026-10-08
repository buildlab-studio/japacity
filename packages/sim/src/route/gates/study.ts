// The study gate: docs/rules/route.md. The schools, the deposit, the funds held
// a month and the interview are the shared machine's, so this module adds only
// what applying needs and what the decision reads.
import type { Gate } from "./gate";
import { EVERY_TERM } from "./gate";

export const studyGate: Gate = {
  gate: "study",
  steps: [],
  initial: () => ({ gate: "study" }),
  reached: () => false,
  // R-ROUTE-012: a school's deposit paid and the funds covered for a month.
  mayApply: (_ctx, _entry, held) => held.school !== null && held.funds.heldMonths >= 1,
  decision: () => ({ terms: EVERY_TERM, override: null, bans: false }),
};
