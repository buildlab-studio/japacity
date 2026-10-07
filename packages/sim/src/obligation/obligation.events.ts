import type { Id, ObligationState } from "../engine/types";

/** How an obligation came to close (R-OBLIGATION-009). */
export type ClosedWhy = "paid" | "returned";

export type ObligationEvent =
  /** A new obligation, from the effect `obligation/open` (R-OBLIGATION-006). */
  | { type: "obligation/opened"; item: ObligationState }
  /**
   * A month's charge was paid in full (R-OBLIGATION-002). `principal` is the
   * part that lowered what is owed; `total` is everything taken.
   */
  | { type: "obligation/charged"; id: string; entry: Id<"obligation">; total: number; interest: number; principal: number }
  /** A month's charge could not be paid. `missed` is the count of misses in a row after this one (R-OBLIGATION-003). */
  | { type: "obligation/missed"; id: string; entry: Id<"obligation">; total: number; missed: number }
  /** A loan went past its grace (R-OBLIGATION-005). */
  | { type: "obligation/defaulted"; id: string; entry: Id<"obligation">; outstanding: number }
  /** The lender took this much from the naira bank toward a defaulted loan (R-OBLIGATION-005). */
  | { type: "obligation/seized"; id: string; entry: Id<"obligation">; amount: number }
  /** The player paid this much off a loan (R-OBLIGATION-008). */
  | { type: "obligation/repaid"; id: string; entry: Id<"obligation">; amount: number }
  /** Interest on held funds was missed and the lender took the principal back. The obligation is gone (R-OBLIGATION-007). */
  | { type: "obligation/taken-back"; id: string; entry: Id<"obligation">; amount: number }
  /** Nothing is owed any more, or held funds went back by choice. The obligation is removed (R-OBLIGATION-009). */
  | { type: "obligation/closed"; id: string; entry: Id<"obligation">; why: ClosedWhy };
