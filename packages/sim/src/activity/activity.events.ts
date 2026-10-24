import type { Currency, Id, MoneyParam, SlotPick } from "../engine/types";

/** Why a slot did not happen (activity:slots-resolve-in-order). `param`: the pick is no longer one it may take. */
export type SlotFailure = "requirements" | "param" | "cost";

/** A prize at the kiosk (luck:kiosk-sells-lotto-tickets). */
export type Prize = "small" | "mid" | "jackpot";

export type ActivityEvent =
  /** A job was taken, replacing the one held, if any (activity:new-job-replaces-held). */
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
  /** A cash job's pay was not paid this month (ladders:cash-jobs-paid-in-hand). */
  | { type: "activity/pay-withheld"; job: Id<"activity">; pay: MoneyParam }
  /** A month on sick pay (health:sick-pay-unless-sick-leave): `pay` is what was paid. */
  | { type: "activity/sick-pay"; job: Id<"activity">; pay: MoneyParam }
  /** A side job was taken, replacing the one held, if any (activity:side-job-holds-a-slot). */
  | { type: "activity/side-started"; side: Id<"activity">; previous: Id<"activity"> | null }
  /** The side job was left. `why` is `quit` for the command, or why it could not go on. */
  | { type: "activity/side-ended"; side: Id<"activity">; why: string }
  /** A month in the side job: its months are now `tenure` (activity:each-trade-climbs-its-ladder, night support toward remote support). */
  | { type: "activity/side-worked"; side: Id<"activity">; pay: MoneyParam | null; tenure: number }
  /** The bus home was a robbery (activity:one-chance-bus-robbery): the cash and the phone went. */
  | { type: "activity/robbed"; cash: number; phone: number }
  /** Overtime paid this much (ladders.md "Free slots abroad"). Changes nothing itself. */
  | { type: "activity/overtime-paid"; job: Id<"activity">; pay: MoneyParam }
  /** An attempt at the driving test (car:licence-and-driving-test). `attempt` counts from 1. */
  | { type: "activity/driving-test"; attempt: number; passed: boolean }
  /** A month at the lotto kiosk (luck:kiosk-sells-lotto-tickets). `prizes` holds one entry for each winning ticket. */
  | { type: "activity/lotto-played"; tickets: number; stake: MoneyParam; prizes: Prize[]; won: MoneyParam }
  /** A bet slip (luck:bet-slip-stake-and-odds). `won` is nothing on a loss. */
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
  /** The slots sent this month, kept for "same again" (activity:last-month-plan-kept). */
  | { type: "activity/slots-recorded"; slots: SlotPick[] }
  /** The activities that filled a slot this month, main, side or free, each once (activity:months-played-counted). */
  | { type: "activity/played-counted"; activities: Id<"activity">[] }
  /**
   * Someone who went told the route's checklist as it stood when they left (advice:someone-who-went-answers-free).
   * `wrong`: the item they have out of date, if the rules changed since; `metWrong`: the player meets it now. Changes nothing.
   */
  | { type: "activity/word-of-mouth"; route: Id<"route">; items: string[]; wrong: string | null; metWrong: boolean }
  /**
   * activity:waiting-months-build-profile: a month of trying to be noticed at the job held. `raised`: the draw landed and the job's pay rose
   * from `was` to `pay` a month. `month`: the month it was played, kept with a raise for the Jobs app.
   */
  | { type: "activity/noticed"; job: Id<"activity">; raised: boolean; pay: MoneyParam; was: MoneyParam; month: number }
  /** activity:naira-pay-reviewed-yearly: the reviewed job's pay as held from its start, and the official dollar rate that day (kobo for one dollar). */
  | { type: "activity/pay-held"; job: Id<"activity">; pay: number; rate: number }
  /** activity:naira-pay-reviewed-yearly: a year's review moved the held pay from `was` to `pay` a month, at the official dollar rate `rate`. */
  | { type: "activity/reviewed"; job: Id<"activity">; was: MoneyParam; pay: MoneyParam; rate: number }
  /** activity:free-path-keeps-a-streak: the free path's months in a row are now `months`; 0 after a month without it. */
  | { type: "activity/streak"; months: number }
  /** activity:free-path-keeps-a-streak: a fifth month in a row finished a certificate. Its gains follow. */
  | { type: "activity/certificate" }
  /** activity:paid-tech-courses: a month of the tech study path held; `months` counted toward it so far. */
  | { type: "activity/course-month"; activity: Id<"activity">; months: number }
  /** activity:paid-tech-courses: the path's months are done. Its closing gains follow. */
  | { type: "activity/course-finished"; activity: Id<"activity"> }
  /** activity:bootcamp-paid-after-a-job: the bootcamp finished in `month`, leaving `owed` to pay once a developer job is held. */
  | { type: "activity/bootcamp-done"; owed: number; month: number }
  /** activity:bootcamp-paid-after-a-job: the first developer job opened the bootcamp's loan; nothing is owed on the slice any more. */
  | { type: "activity/bootcamp-billed"; owed: number }
  /** activity:waiting-months-build-profile: a course at home in progress ended with the flight; its fees close with it. */
  | { type: "activity/course-ended"; activity: Id<"activity"> }
  /** activity:waiting-months-build-profile: a month of open source that added no piece; `first` for the life's first. Changes nothing. */
  | { type: "activity/contributed"; first: boolean }
  /** activity:waiting-months-build-profile: a quiz marked, `right` of `asked`; `pass` right answers were needed. A pass's effects follow. */
  | { type: "activity/exam-marked"; activity: Id<"activity">; right: number; asked: number; pass: number; passed: boolean }
  /**
   * A now-act sent with `activity/now` (activity:now-acts-and-month-acts): kept with the month's other now-acts. Its cost and effects follow.
   * `counted`: a repeat act counts as played at once (activity:acts-may-repeat-in-month); the month counts the others once.
   */
  | { type: "activity/now-played"; activity: Id<"activity">; param: string | null; counted?: true }
  /** The place answers a now-act in a person's voice (activity:now-acts-and-month-acts). `ready`: the month a paper asked for is due, else null. Changes nothing. */
  | { type: "activity/now-said"; activity: Id<"activity">; param: string | null; ready: number | null }
  /** The month closed: its now-acts are done with, and the next month starts with none (activity:now-acts-and-month-acts). */
  | { type: "activity/now-cleared" }
  /** The adviser read the whole file (advice:licensed-adviser-is-truthful): each route heard or known, whether it fits, what is missing, the months away. Changes nothing. */
  | { type: "activity/advised"; routes: { route: Id<"route">; fits: boolean; missing: string[]; months: number }[] };
