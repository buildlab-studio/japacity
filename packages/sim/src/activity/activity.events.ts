import type { Currency, Id, MoneyParam, SlotPick } from "../engine/types";

/** Why a slot did not happen (R-ACTIVITY-003). `param`: the pick is no longer one it may take. */
export type SlotFailure = "requirements" | "param" | "cost";

/** A prize at the kiosk (R-LUCK-005). */
export type Prize = "small" | "mid" | "jackpot";

export type ActivityEvent =
  /** A job was taken, replacing the one held, if any (R-ACTIVITY-006). */
  | { type: "activity/job-started"; job: Id<"activity">; previous: Id<"activity"> | null }
  /** The job was left. `why` is `quit` for the command, or what the effect said. Tenure is kept. */
  | { type: "activity/job-ended"; job: Id<"activity">; why: string }
  /**
   * A month in the job: tenure is now `tenure`. `pay` is what was paid before tax, null when
   * nothing was. `naira` is a foreign pay's worth at the official rate that day, for the
   * staged first pay in that currency (text.md "Money on screen").
   */
  | {
      type: "activity/month-worked";
      job: Id<"activity">;
      tenure: number;
      pay: { currency: Currency; amount: number } | null;
      naira?: number;
    }
  /** A cash job's pay was not paid this month (R-LADDER-003). */
  | { type: "activity/pay-withheld"; job: Id<"activity">; pay: MoneyParam }
  /** A month on sick pay (R-HEALTH-004): `pay` is what was paid. */
  | { type: "activity/sick-pay"; job: Id<"activity">; pay: MoneyParam }
  /** A side job was taken, replacing the one held, if any (R-ACTIVITY-010). */
  | { type: "activity/side-started"; side: Id<"activity">; previous: Id<"activity"> | null }
  /** The side job was left. `why` is `quit` for the command, or why it could not go on. */
  | { type: "activity/side-ended"; side: Id<"activity">; why: string }
  /** A month in the side job. */
  | { type: "activity/side-worked"; side: Id<"activity">; pay: MoneyParam | null }
  /** The bus home was a robbery (R-ACTIVITY-011): the cash and the phone went. */
  | { type: "activity/robbed"; cash: number; phone: number }
  /** Overtime paid this much (ladders.md "Free slots abroad"). Changes nothing itself. */
  | { type: "activity/overtime-paid"; job: Id<"activity">; pay: MoneyParam }
  /** An attempt at the driving test (R-CAR-006). `attempt` counts from 1. */
  | { type: "activity/driving-test"; attempt: number; passed: boolean }
  /** A month at the lotto kiosk (R-LUCK-005). `prizes` holds one entry for each winning ticket. */
  | { type: "activity/lotto-played"; tickets: number; stake: MoneyParam; prizes: Prize[]; won: MoneyParam }
  /** A bet slip (R-LUCK-006). `won` is nothing on a loss. */
  | { type: "activity/bet-placed"; stake: MoneyParam; won: MoneyParam }
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
  | { type: "activity/slots-recorded"; slots: SlotPick[] }
  /** The activities that filled a slot this month, main, side or free, each once (R-ACTIVITY-012). */
  | { type: "activity/played-counted"; activities: Id<"activity">[] }
  /**
   * Someone who went told the route's checklist as it stood when they left (R-ADVICE-003).
   * `wrong`: the item they have out of date, if the rules changed since; `metWrong`: the player meets it now. Changes nothing.
   */
  | { type: "activity/word-of-mouth"; route: Id<"route">; items: string[]; wrong: string | null; metWrong: boolean }
  /** R-ACTIVITY-013: a month of trying to be noticed at the job held. `raised`: the draw landed and the job's pay rose to `pay` a month. */
  | { type: "activity/noticed"; job: Id<"activity">; raised: boolean; pay: MoneyParam }
  /** R-ACTIVITY-013: a quiz marked, `right` of `asked`; `pass` right answers were needed. A pass's effects follow. */
  | { type: "activity/exam-marked"; activity: Id<"activity">; right: number; asked: number; pass: number; passed: boolean }
  /** The adviser read the whole file (R-ADVICE-004): each route heard or known, whether it fits, what is missing, the months away. Changes nothing. */
  | { type: "activity/advised"; routes: { route: Id<"route">; fits: boolean; missing: string[]; months: number }[] };
