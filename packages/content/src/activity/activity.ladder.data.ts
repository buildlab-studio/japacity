// The trades' ladders at home (activity:each-trade-climbs-its-ladder): the rungs above each trade's first job, the side
// job of each trade, and own work opened with its capital (activity:capital-opens-own-work). From activity.md, "Jobs: the
// ladders" and "Side jobs"; the real figure behind each pay is in its Numbers table. Joined into the activity table in activity.data.ts.
import type { ActivityEntry, Effect, Id, Requirement } from "@japacity/sim";

import { dollars, naira, pct } from "../units";
import { BOAT_JOBS } from "./activity.boat.data";

const NURSE: Id<"activity"> = "activity.job-nurse";
const SENIOR_NURSE: Id<"activity"> = "activity.job-senior-nurse";
const WARD_MANAGER: Id<"activity"> = "activity.job-ward-manager";
const TEACHER: Id<"activity"> = "activity.job-teacher";
const SENIOR_TEACHER: Id<"activity"> = "activity.job-senior-teacher";
const HEAD_OF_DEPARTMENT: Id<"activity"> = "activity.job-head-of-department";
const AGENT: Id<"activity"> = "activity.job-customer-service";
const TEAM_LEAD: Id<"activity"> = "activity.job-team-lead";
const REMOTE_SUPPORT: Id<"activity"> = "activity.job-remote-support";
const NIGHT_SUPPORT: Id<"activity"> = "activity.night-support";
const PHONE_SALES: Id<"activity"> = "activity.job-phone-sales";
const RACKS: Id<"activity"> = "activity.job-fish-racks";
const KILN: Id<"activity"> = "activity.job-fish-smoker";
const FISH_TRADER: Id<"activity"> = "activity.job-fish-trader";
const BANK_OFFICER: Id<"activity"> = "activity.job-bank-officer";
const BANK_SENIOR: Id<"activity"> = "activity.job-bank-senior";
const RELATIONSHIP_MANAGER: Id<"activity"> = "activity.job-relationship-manager";
const ACCOUNTS_OFFICER: Id<"activity"> = "activity.job-accounts-officer";
const CHARTERED: Id<"activity"> = "activity.job-chartered-accountant";
const FINANCE_MANAGER: Id<"activity"> = "activity.job-finance-manager";
const POS_STAND: Id<"activity"> = "activity.pos-stand";

export const NURSE_JOBS: Id<"activity">[] = [NURSE, SENIOR_NURSE, WARD_MANAGER];
export const TEACHER_JOBS: Id<"activity">[] = [TEACHER, SENIOR_TEACHER, HEAD_OF_DEPARTMENT];
/** The support jobs: the agent, the team lead, remote support and night support, whose months count toward remote support. */
export const SUPPORT_JOBS: Id<"activity">[] = [AGENT, TEAM_LEAD, REMOTE_SUPPORT, NIGHT_SUPPORT];
const FISH_JOBS: Id<"activity">[] = [RACKS, KILN, FISH_TRADER];
/** The bank jobs count among the accounting jobs as well, since an accountant may start at the bank. */
export const ACCOUNTING_JOBS: Id<"activity">[] = [ACCOUNTS_OFFICER, CHARTERED, FINANCE_MANAGER, BANK_OFFICER, BANK_SENIOR, RELATIONSHIP_MANAGER];
const BANK_JOBS: Id<"activity">[] = [BANK_OFFICER, BANK_SENIOR, RELATIONSHIP_MANAGER];
/** The chartered accountant's rung and the finance manager's above it, which an accountancy firm sponsors. */
export const CHARTERED_JOBS: Id<"activity">[] = [CHARTERED, FINANCE_MANAGER];
/**
 * Each trade's ladder at home, from its first rung to its top: what a recruitment agency reads as a trade's record
 * (route-gates:sponsor-offers-come-up). The bank's rungs are their own ladder and count among the accounting jobs too.
 */
export const TRADE_LADDERS: Id<"activity">[][] = [
  NURSE_JOBS,
  TEACHER_JOBS,
  SUPPORT_JOBS,
  [PHONE_SALES, "activity.job-shop-supervisor", "activity.run-shop"],
  FISH_JOBS,
  BOAT_JOBS,
  BANK_JOBS,
  ACCOUNTING_JOBS,
  ["activity.job-junior-developer", "activity.job-mid-developer", "activity.job-remote-developer"],
];
/** "Lives in Makoko" is the room on the lagoon being rented, as the racks read it. */
const LIVES_IN_MAKOKO: Requirement = { type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-makoko" };

function atLeast(quality: string, value: number): Requirement {
  return { type: "quality/min", quality: quality as Id<"quality">, value };
}

function across(activities: Id<"activity">[], months: number): Requirement {
  return { type: "activity/tenure", activities, months };
}

function adds(quality: string, amount: number): Effect {
  return { type: "quality/add", quality: quality as Id<"quality">, amount };
}

/** A rung hunted like any job: its pay a month, what it asks, its hire chance, its month's effects and its employer. */
function rung(id: Id<"activity">, pay: ActivityEntry["pay"], requires: Requirement[], hireBp: number, effects: Effect[], employer?: ActivityEntry["employer"]): ActivityEntry {
  return { id, slot: "main", ...(employer === undefined ? {} : { employer }), requires, param: null, cost: [], pay, hireBp, effects, counts: [] };
}

/** A side job hunted like a job and held beside it (activity:side-job-holds-a-slot). */
function side(id: Id<"activity">, pay: ActivityEntry["pay"], requires: Requirement[], hireBp: number | null, wellbeing: number, extra: Partial<ActivityEntry> = {}): ActivityEntry {
  return { id, slot: "side", ...extra, requires, param: null, cost: [], pay, hireBp, effects: [adds("quality.wellbeing", wellbeing)], counts: [] };
}

/** Own work opened now with its capital under `goods` (activity:capital-opens-own-work). */
function opens(id: Id<"activity">, job: Id<"activity">, capital: number, requires: Requirement[]): ActivityEntry {
  return {
    id,
    slot: "free",
    where: "home",
    requires,
    param: null,
    cost: [{ currency: "NGN", amount: naira(capital), reason: "goods" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "activity/start-job", job }],
    counts: [],
  };
}

const NGN = (whole: number): ActivityEntry["pay"] => ({ currency: "NGN", amount: naira(whole) });

export const ladderActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // The nurse's ladder: the ward grades of a private hospital.
  [SENIOR_NURSE]: rung(SENIOR_NURSE, NGN(280000), [across(NURSE_JOBS, 30), atLeast("quality.care", 70)], pct(30), [adds("quality.wellbeing", -4), adds("quality.care", 1), adds("quality.standing", 1)], "formal"),
  [WARD_MANAGER]: rung(
    WARD_MANAGER,
    NGN(420000),
    [across(NURSE_JOBS, 60), atLeast("quality.care", 80), atLeast("quality.standing", 50)],
    pct(20),
    [adds("quality.wellbeing", -5), adds("quality.standing", 1), adds("quality.network", 1)],
    "formal",
  ),
  // The teacher's ladder: a better school asks the registration; the head of department a master's or the standing for it.
  // The head of department's 30 months are a working value: at 48 half the writers' lives saved neither way out by month 72.
  [SENIOR_TEACHER]: rung(
    SENIOR_TEACHER,
    NGN(220000),
    [across(TEACHER_JOBS, 18), atLeast("quality.english", 60), { type: "document/held", document: "document.trcn" }],
    pct(40),
    [adds("quality.wellbeing", -3), adds("quality.standing", 1)],
    "formal",
  ),
  [HEAD_OF_DEPARTMENT]: rung(
    HEAD_OF_DEPARTMENT,
    NGN(400000),
    [across(TEACHER_JOBS, 30), { type: "any", of: [atLeast("quality.education-level", 4), atLeast("quality.standing", 60)] }],
    pct(20),
    [adds("quality.wellbeing", -4), adds("quality.standing", 2)],
    "formal",
  ),
  // Customer service: the team lead, then support for a foreign firm in dollars, which the review leaves to the world.
  [TEAM_LEAD]: rung(TEAM_LEAD, NGN(220000), [across(SUPPORT_JOBS, 18), atLeast("quality.english", 60)], pct(35), [adds("quality.wellbeing", -4), adds("quality.network", 1)], "formal"),
  [REMOTE_SUPPORT]: rung(
    REMOTE_SUPPORT,
    { currency: "USD", amount: dollars(500) },
    [across(SUPPORT_JOBS, 24), atLeast("quality.english", 70), atLeast("quality.tech", 20)],
    pct(15),
    [adds("quality.wellbeing", -5)],
  ),
  // The shop: a supervisor above phone sales; your own stall is the top (activity:trader-opens-own-shop).
  "activity.job-shop-supervisor": rung("activity.job-shop-supervisor", NGN(120000), [across([PHONE_SALES], 12), atLeast("quality.network", 30)], pct(40), [adds("quality.wellbeing", -2)], "informal"),
  // The fish trade: own work, opened not hunted. Its months are what the board's ladder reads; the capital is the act's.
  [KILN]: { id: KILN, slot: "main", employer: "own", where: "home", requires: [across([RACKS], 12)], param: null, cost: [], pay: NGN(120000), hireBp: null, effects: [adds("quality.wellbeing", -4)], counts: [] },
  [FISH_TRADER]: {
    id: FISH_TRADER,
    slot: "main",
    employer: "own",
    where: "home",
    requires: [across(FISH_JOBS, 30)],
    param: null,
    cost: [],
    pay: NGN(200000),
    hireBp: null,
    effects: [adds("quality.wellbeing", -3), adds("quality.standing", 1)],
    counts: [],
  },
  // The banker's top rung. The bank pays through a sick month (health:sick-pay-unless-sick-leave), as at the rungs below.
  [RELATIONSHIP_MANAGER]: {
    ...rung(RELATIONSHIP_MANAGER, NGN(900000), [across([BANK_SENIOR], 36), atLeast("quality.network", 50)], pct(15), [adds("quality.network", 2), adds("quality.wellbeing", -6)], "formal"),
    sickLeave: true,
  },
  // The accountant's ladder: the chartered exams are the key (document:trade-papers).
  [ACCOUNTS_OFFICER]: rung(ACCOUNTS_OFFICER, NGN(200000), [atLeast("quality.education-level", 3)], pct(50), [adds("quality.wellbeing", -3)], "formal"),
  [CHARTERED]: rung(CHARTERED, NGN(400000), [across(ACCOUNTING_JOBS, 24), { type: "document/held", document: "document.ican" }], pct(35), [adds("quality.wellbeing", -4), adds("quality.network", 1)], "formal"),
  [FINANCE_MANAGER]: rung(
    FINANCE_MANAGER,
    NGN(700000),
    [across([CHARTERED], 36), atLeast("quality.network", 40)],
    pct(20),
    [adds("quality.wellbeing", -5), adds("quality.network", 1), adds("quality.standing", 1)],
    "formal",
  ),

  // The side job of each trade (activity.md, "Side jobs"). Night support and home lessons are in activity.data.ts.
  "activity.home-care-visits": side("activity.home-care-visits", NGN(80000), [{ type: "document/held", document: "document.nursing-licence" }], pct(50), -5, {
    tiers: [{ needs: [atLeast("quality.care", 75)], pay: { currency: "NGN", amount: naira(120000) } }],
  }),
  "activity.phone-repairs": side("activity.phone-repairs", NGN(50000), [atLeast("quality.tech", 20)], pct(50), -4),
  "activity.canoe-deliveries": side("activity.canoe-deliveries", NGN(80000), [LIVES_IN_MAKOKO], pct(70), -5, { where: "home" }),
  // A cousin runs it in the cousin's name, since banks bar their staff from outside business. Opened, not hunted.
  [POS_STAND]: side(POS_STAND, NGN(60000), [], null, -2, {
    employer: "own",
    where: "home",
    tiers: [{ needs: [atLeast("quality.network", 60)], pay: { currency: "NGN", amount: naira(90000) } }],
  }),
  "activity.bookkeeping": side("activity.bookkeeping", NGN(70000), [atLeast("quality.education-level", 3)], pct(40), -4),

  // Own work opened with its capital (activity:capital-opens-own-work): the kiln and the first stock, the fish trade, the machine and the float.
  "activity.buy-kiln": opens("activity.buy-kiln", KILN, 100000, [across([RACKS], 12), { type: "not", of: { type: "job/is", activities: [KILN] } }]),
  "activity.start-fish-trade": opens("activity.start-fish-trade", FISH_TRADER, 300000, [across([RACKS, KILN], 30), { type: "not", of: { type: "job/is", activities: [FISH_TRADER] } }]),
  "activity.open-pos-stand": opens("activity.open-pos-stand", POS_STAND, 300000, [{ type: "job/is", activities: BANK_JOBS }]),
};
