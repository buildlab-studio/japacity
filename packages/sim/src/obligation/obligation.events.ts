import type { Id, ObligationState } from "../engine/types";

/**
 * How an obligation came to close (obligation:closed-obligation-removed). `closed`: by type, from
 * another kind (a move or a return). `ended`: a circle or an undertaking ran its
 * term. `dropped`: a savings circle closed on a miss (luck:savings-circle-holds-pot).
 */
export type ClosedWhy = "paid" | "returned" | "closed" | "ended" | "dropped";

export type ObligationEvent =
  /** A new obligation, from the effect `obligation/open` (obligation:loan-opening-credits-principal). */
  | { type: "obligation/opened"; item: ObligationState }
  /**
   * A month's charge was paid in full (obligation:charges-paid-whole-or-missed). `principal` is the
   * part that lowered what is owed; `total` is everything taken.
   */
  | { type: "obligation/charged"; id: string; entry: Id<"obligation">; total: number; interest: number; principal: number; relief?: { source: string; amount: number }[] }
  /** A month's charge could not be paid. `missed` is the count of misses in a row after this one (obligation:miss-applies-its-effects). */
  | { type: "obligation/missed"; id: string; entry: Id<"obligation">; total: number; missed: number; paid?: number }
  /**
   * A first miss in a row on a group loan: the group paid the lender and the
   * charge is added to what is owed (obligation:group-covers-misses-at-cost). `principal` is the part
   * the lender counted as repaid.
   */
  | { type: "obligation/covered"; id: string; entry: Id<"obligation">; total: number; principal: number; missed: number }
  /** Missed more times in a row than the grace allows (obligation:loan-default-and-recovery, abroad-money:arrival-opens-upkeep-and-room, abroad-money:tuition-paid-in-instalments). */
  | { type: "obligation/defaulted"; id: string; entry: Id<"obligation">; outstanding: number }
  /** The lender took this much from the bank toward a defaulted loan (obligation:loan-default-and-recovery). */
  | { type: "obligation/seized"; id: string; entry: Id<"obligation">; amount: number }
  /** The player paid this much off a loan (obligation:paying-down-obligations). */
  | { type: "obligation/repaid"; id: string; entry: Id<"obligation">; amount: number }
  /** Interest on held funds was missed and the lender took the principal back. The obligation is gone (obligation:missed-interest-recalls-held-funds). */
  | { type: "obligation/taken-back"; id: string; entry: Id<"obligation">; amount: number }
  /** Nothing is owed any more, or it was closed (obligation:closed-obligation-removed). The obligation is removed. */
  | { type: "obligation/closed"; id: string; entry: Id<"obligation">; why: ClosedWhy }
  /** The savings circle paid its pot (luck:savings-circle-holds-pot). */
  | { type: "obligation/pot-paid"; id: string; entry: Id<"obligation">; amount: number }
  /** A car's arrears were paid in one go: `months` charges, `principal` of them off what is owed (car:missed-payments-take-the-car). */
  | { type: "obligation/caught-up"; id: string; entry: Id<"obligation">; months: number; total: number; principal: number }
  /** The lender went to court over a car with a third or more paid; the car goes in `takenMonth` (car:missed-payments-take-the-car). */
  | { type: "obligation/court"; id: string; entry: Id<"obligation">; takenMonth: number }
  /** The car was taken (car:missed-payments-take-the-car). `shortfall` is what is still owed after its resale. The obligation is removed. */
  | { type: "obligation/repossessed"; id: string; entry: Id<"obligation">; owed: number; shortfall: number }
  /** The car went back to the lender with nothing more owed on it (car:car-handed-back-after-half, car:final-payment-owns-the-car). The obligation is removed. */
  | { type: "obligation/handed-back"; id: string; entry: Id<"obligation">; shortfall: number }
  /** The final payment was made: the car is the character's, and nothing is owed (car:final-payment-owns-the-car). */
  | { type: "obligation/owned"; id: string; entry: Id<"obligation"> }
  /** An unpaid ransom was added to the agent's debt already open (road:chain-steps-monthly). */
  | { type: "obligation/grown"; id: string; entry: Id<"obligation">; amount: number }
  /**
   * A sponsor's undertaking counted `months` more months of assistance taken by
   * the sponsored partner and now owes `amount` more for them (undertaking:assistance-charged-to-sponsor).
   */
  | { type: "obligation/assessed"; id: string; entry: Id<"obligation">; months: number; amount: number }
  /**
   * A share off the next charge, earned by the activity `source`: `bp` of the charge, spent by it
   * whether it is paid or missed (obligation:cooking-and-fetching-water). `relief` on the charged event says what it took.
   */
  | { type: "obligation/relieved"; id: string; entry: Id<"obligation">; source: string; bp: number }
  /** Everything owed on an undertaking is paid: the misses and any default are lifted (undertaking:missed-charges-lead-to-default). */
  | { type: "obligation/cleared"; id: string; entry: Id<"obligation"> }
  /** A stage of a missed tuition payment, told as the university's letter (abroad-money:missed-tuition-runs-in-stages); withdrawal is the default. */
  | { type: "obligation/staged"; id: string; entry: Id<"obligation">; stage: TuitionStage }
  /** The tuition owed was turned into a payment plan (abroad-money:missed-tuition-runs-in-stages); the cut of access ends. */
  | { type: "obligation/planned"; id: string; entry: Id<"obligation">; plan: NonNullable<ObligationState["plan"]> };

/** abroad-money:missed-tuition-runs-in-stages: the reminder, the cut of access with the plan offered, and the final warning. */
export type TuitionStage = "reminder" | "cut" | "warning";
