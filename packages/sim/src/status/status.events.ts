import type { Currency, Id, OverstayState } from "../engine/types";

/** How a status came to be granted: by an effect, by its own `next`, by settling, by citizenship, or as the overstayer after a lapse. */
export type GrantWhy = "granted" | "next" | "settled" | "citizen" | "lapsed";

/** Why a status lapsed: its time ran out, its clock ran out, it was lost (a withdrawal), or the job it held went (status:gulf-status-holds-passport). */
export type LapseWhy = "expired" | "clock" | "lost" | "job";

export type StatusEvent =
  /** status:granting-a-status. `fee` is what settling or citizenship cost, paid as a foreign fee (status:lawful-months-reach-settlement). */
  | {
      type: "status/granted";
      status: Id<"status">;
      month: number;
      expiresMonth: number | null;
      lawfulMonths: number;
      /** 0 for a status granted anew; a status kept from a return with papers carries its months on (return:papers-return-keeps-status). */
      monthsHeld: number;
      job: Id<"activity"> | null;
      why: GrantWhy;
      fee: { currency: Currency; amount: number } | null;
      /** An overstayer status's stages from its first month (status:overstayer-risks-detection, status:grace-before-overstaying). */
      overstay?: OverstayState;
      /** A partner status granted in country past the grace settles at these months (person:partner-route-in-country). */
      settleMonths?: number;
    }
  /** status:expiry-lapses-or-moves-on, status:overstayer-risks-detection, status:course-passed-or-withdrawn. The current status is gone; the overstayer status follows in its own event. */
  | { type: "status/lapsed"; status: Id<"status">; why: LapseWhy }
  /** status:lost-job-starts-clock: the job went on a status with a clock. */
  | { type: "status/clock-started"; months: number }
  /** One month of the clock has run; `left` months remain. */
  | { type: "status/clock-ran"; left: number }
  /** A job the status allows is held again, so the clock stops. */
  | { type: "status/clock-cleared" }
  /** status:renewing-a-status. */
  | { type: "status/renewed"; expiresMonth: number; months: number; currency: Currency; fee: number; surcharge: number }
  /** status:renewing-a-status: the employer renewed the contract in its last month, for no fee. */
  | { type: "status/employer-renewed"; status: Id<"status">; expiresMonth: number; months: number }
  /** One month held; `lawful` when it counts toward settling (status:lawful-months-reach-settlement). */
  | { type: "status/aged"; lawful: boolean }
  /** status:removal-sends-home-banned. */
  | { type: "status/removed"; status: Id<"status"> | null; country: Id<"country">; month: number; banMonths: number }
  /** The character is home and holds nothing abroad (place:return-home-paid-or-assisted). */
  | { type: "status/closed"; status: Id<"status"> }
  /** status:grace-before-overstaying: an application made in country holds the grace through this month. */
  | { type: "status/grace-held"; graceUntil: number }
  /** status:detection-gives-notice: found, with a notice to this month. */
  | { type: "status/noticed"; country: Id<"country">; noticeUntil: number; months: number }
  /** status:notice-ends-in-removal: an application made in country holds the notice to this month. */
  | { type: "status/notice-held"; noticeUntil: number }
  /** status:uae-fine-accrues: a month's fine added. */
  | { type: "status/fined"; amount: number }
  /** abroad-money:right-to-rent-check: the landlord's check ended the room. */
  | { type: "status/rent-checked" };
