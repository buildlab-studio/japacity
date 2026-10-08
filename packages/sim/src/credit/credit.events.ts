import type { Id } from "../engine/types";

export type CreditEvent =
  /**
   * A payment moved the file (R-CREDIT-002). `asked` is the change asked for and
   * says whether it counts as on time or missed; `points` is the change after the
   * mark is held between 0 and 100.
   */
  | { type: "credit/marked"; country: Id<"country">; asked: number; points: number; month: number }
  /** A court judgment is on the file until `until` (R-CREDIT-006). */
  | { type: "credit/judged"; country: Id<"country">; until: number }
  /** A clean year moved the mark up by `points` (R-CREDIT-003). */
  | { type: "credit/drifted"; country: Id<"country">; points: number }
  /** A second arrival in a country found the file kept, less the return penalty (R-CREDIT-001). */
  | { type: "credit/reopened"; country: Id<"country">; points: number };
