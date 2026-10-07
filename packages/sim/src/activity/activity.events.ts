import type { Currency, Id, SlotPick } from "../engine/types";

/** Why a slot did not happen (R-ACTIVITY-003). `param`: the pick is no longer one it may take. */
export type SlotFailure = "requirements" | "param" | "cost";

export type ActivityEvent =
  /** A job was taken, replacing the one held, if any (R-ACTIVITY-006). */
  | { type: "activity/job-started"; job: Id<"activity">; previous: Id<"activity"> | null }
  /** The job was left. `why` is `quit` for the command, or what the effect said. Tenure is kept. */
  | { type: "activity/job-ended"; job: Id<"activity">; why: string }
  /** A month in the job: tenure is now `tenure`. `pay` is what the salary was, for the report. */
  | { type: "activity/month-worked"; job: Id<"activity">; tenure: number; pay: { currency: Currency; amount: number } | null }
  /** A free slot resolved and its cost and effects follow. Changes nothing itself. */
  | { type: "activity/slot-played"; slot: number; activity: Id<"activity">; param: string | null }
  /** A free slot failed: nothing paid, no effect. Changes nothing itself. */
  | { type: "activity/slot-failed"; slot: number; activity: Id<"activity">; param: string | null; why: SlotFailure }
  /** Slots left empty counted as rest. Changes nothing itself. */
  | { type: "activity/rested"; slots: number }
  /** One month of hunting for a job, and whether it landed. Changes nothing itself. */
  | { type: "activity/hunted"; job: Id<"activity">; hired: boolean }
  /** A side gig paid this much naira. Changes nothing itself: the wallet takes the money. */
  | { type: "activity/gig-paid"; amount: number }
  /** The slots sent this month, kept for "same again" (R-ACTIVITY-009). */
  | { type: "activity/slots-recorded"; slots: SlotPick[] };
