import type { Currency, Id } from "../engine/types";

/** How a status came to be granted: by an effect, by its own `next`, by settling, by citizenship, or as the overstayer after a lapse. */
export type GrantWhy = "granted" | "next" | "settled" | "citizen" | "lapsed";

/** Why a status lapsed: its time ran out, its clock ran out, it was lost (a withdrawal), or the job it held went (R-STATUS-009). */
export type LapseWhy = "expired" | "clock" | "lost" | "job";

export type StatusEvent =
  /** R-STATUS-001. `fee` is what settling or citizenship cost, paid as a foreign fee (R-STATUS-007). */
  | {
      type: "status/granted";
      status: Id<"status">;
      month: number;
      expiresMonth: number | null;
      lawfulMonths: number;
      job: Id<"activity"> | null;
      why: GrantWhy;
      fee: { currency: Currency; amount: number } | null;
    }
  /** R-STATUS-004, 005, 011. The current status is gone; the overstayer status follows in its own event. */
  | { type: "status/lapsed"; status: Id<"status">; why: LapseWhy }
  /** R-STATUS-003: the job went on a status with a clock. */
  | { type: "status/clock-started"; months: number }
  /** One month of the clock has run; `left` months remain. */
  | { type: "status/clock-ran"; left: number }
  /** A job the status allows is held again, so the clock stops. */
  | { type: "status/clock-cleared" }
  /** R-STATUS-006. */
  | { type: "status/renewed"; expiresMonth: number; months: number; currency: Currency; fee: number; surcharge: number }
  /** One month held; `lawful` when it counts toward settling (R-STATUS-007). */
  | { type: "status/aged"; lawful: boolean }
  /** R-STATUS-008. */
  | { type: "status/removed"; status: Id<"status"> | null; country: Id<"country">; month: number; banMonths: number }
  /** The character is home and holds nothing abroad (R-PLACE-004). */
  | { type: "status/closed"; status: Id<"status"> };
