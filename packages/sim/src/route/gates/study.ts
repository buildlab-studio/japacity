// The study gate: docs/rules/route.md. The schools, the deposit, the funds held
// a month and the interview are the shared machine's, so this module adds only
// what applying needs, what the decision reads, and the tuition that opens as
// the student leaves (R-ABROAD-005).
import type { Id } from "../../engine/types";
import type { Gate } from "./gate";
import { EVERY_TERM } from "./gate";

const TUITION: Id<"obligation"> = "obligation.tuition";

export const studyGate: Gate = {
  gate: "study",
  steps: [],
  initial: () => ({ gate: "study" }),
  reached: () => false,
  // R-ROUTE-012: a school's deposit paid and the funds covered for a month.
  mayApply: (_ctx, _entry, held) => held.school !== null && held.funds.heldMonths >= 1,
  decision: () => ({ terms: EVERY_TERM, override: null, bans: false }),
  // R-ABROAD-005: the course less the deposit and the discount is owed from arrival, in three parts.
  onDepart: (ctx, _entry, held, cause) => {
    if (held.school === null || ctx.content.obligation[TUITION] === undefined) return;
    const school = ctx.content.school[held.school];
    if (school === undefined) return;
    const principal = school.tuition - (held.schools[held.school]?.discount ?? 0) - held.depositPaid;
    if (principal > 0) ctx.apply([{ type: "obligation/open", obligation: TUITION, principal }], cause);
  },
};
