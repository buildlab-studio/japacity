import type { Id, ObligationState } from "../engine/types";

/**
 * How an obligation came to close (R-OBLIGATION-009). `closed`: by type, from
 * another kind (a move or a return). `ended`: a circle or an undertaking ran its
 * term. `dropped`: a savings circle closed on a miss (R-LUCK-009).
 */
export type ClosedWhy = "paid" | "returned" | "closed" | "ended" | "dropped";

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
  /**
   * A first miss in a row on a group loan: the group paid the lender and the
   * charge is added to what is owed (R-OBLIGATION-011). `principal` is the part
   * the lender counted as repaid.
   */
  | { type: "obligation/covered"; id: string; entry: Id<"obligation">; total: number; principal: number; missed: number }
  /** Missed more times in a row than the grace allows (R-OBLIGATION-005, R-ABROAD-003, 005). */
  | { type: "obligation/defaulted"; id: string; entry: Id<"obligation">; outstanding: number }
  /** The lender took this much from the bank toward a defaulted loan (R-OBLIGATION-005). */
  | { type: "obligation/seized"; id: string; entry: Id<"obligation">; amount: number }
  /** The player paid this much off a loan (R-OBLIGATION-008). */
  | { type: "obligation/repaid"; id: string; entry: Id<"obligation">; amount: number }
  /** Interest on held funds was missed and the lender took the principal back. The obligation is gone (R-OBLIGATION-007). */
  | { type: "obligation/taken-back"; id: string; entry: Id<"obligation">; amount: number }
  /** Nothing is owed any more, or it was closed (R-OBLIGATION-009). The obligation is removed. */
  | { type: "obligation/closed"; id: string; entry: Id<"obligation">; why: ClosedWhy }
  /** The savings circle paid its pot (R-LUCK-009). */
  | { type: "obligation/pot-paid"; id: string; entry: Id<"obligation">; amount: number }
  /** A car's arrears were paid in one go: `months` charges, `principal` of them off what is owed (R-CAR-003). */
  | { type: "obligation/caught-up"; id: string; entry: Id<"obligation">; months: number; total: number; principal: number }
  /** The lender went to court over a car with a third or more paid; the car goes in `takenMonth` (R-CAR-003). */
  | { type: "obligation/court"; id: string; entry: Id<"obligation">; takenMonth: number }
  /** The car was taken (R-CAR-003). `shortfall` is what is still owed after its resale. The obligation is removed. */
  | { type: "obligation/repossessed"; id: string; entry: Id<"obligation">; owed: number; shortfall: number }
  /** The car went back to the lender with nothing more owed on it (R-CAR-004, R-CAR-005). The obligation is removed. */
  | { type: "obligation/handed-back"; id: string; entry: Id<"obligation">; shortfall: number }
  /** The final payment was made: the car is the character's, and nothing is owed (R-CAR-005). */
  | { type: "obligation/owned"; id: string; entry: Id<"obligation"> }
  /** An unpaid ransom was added to the agent's debt already open (R-ROAD-006). */
  | { type: "obligation/grown"; id: string; entry: Id<"obligation">; amount: number }
  /**
   * A sponsor's undertaking counted `months` more months of assistance taken by
   * the sponsored partner and now owes `amount` more for them (R-UNDERTAKING-007).
   */
  | { type: "obligation/assessed"; id: string; entry: Id<"obligation">; months: number; amount: number }
  /** Everything owed on an undertaking is paid: the misses and any default are lifted (R-UNDERTAKING-008). */
  | { type: "obligation/cleared"; id: string; entry: Id<"obligation"> };
