// From docs/rules/ladders.md "Entries: jobs abroad" and "Entries: free slots
// abroad", car.md and abroad-money.md. Joined into the activity table in
// activity.data.ts.
//
// every activity here also requires `place/is` for its place and country.
// R-PLACE-003 and R-LADDER-001 already make it illegal elsewhere through `where` and
// `country`; the requirement says so in the "why not" list as well.
//
// a job abroad holds its pay a year, not a month. R-ABROAD-002 pays "its
// salary over twelve" less tax on the yearly salary above the tax-free line, the
// ladders table gives pay a year, and `carBonus` is a year too.
//
// a job reached through a sponsor or an agent (uk-care, uk-skilled, the
// two Gulf jobs) pays the `salary` term recorded on the route (R-SPONSOR-007,
// R-CONTRACT-004) and has no hiring chance: it is started by departure, never hunted.
import type { ActivityEntry, Effect, Id, Money, Requirement } from "@japacity/sim";

import { aed, cad, euros, pct, pounds } from "../units";

const ABROAD: Requirement = { type: "place/is", where: "abroad" };
const IN_UK: Requirement = { type: "place/is", where: "abroad", country: "country.uk" };
const IN_CANADA: Requirement = { type: "place/is", where: "abroad", country: "country.canada" };
const IN_UAE: Requirement = { type: "place/is", where: "abroad", country: "country.uae" };
const IN_ITALY: Requirement = { type: "place/is", where: "abroad", country: "country.italy" };

function wellbeing(amount: number): Effect {
  return { type: "quality/add", quality: "quality.wellbeing", amount };
}

function gain(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** A job abroad: the fields every one of them shares. */
function job(
  id: Id<"activity">,
  country: Id<"country">,
  place: Requirement,
  pay: Money,
  hireBp: number | null,
  requires: Requirement[],
  effects: Effect[],
): ActivityEntry {
  return {
    id,
    slot: "main",
    where: "abroad",
    country,
    requires: [place, ...requires],
    param: null,
    cost: [],
    pay,
    hireBp,
    effects,
    counts: [],
  };
}

/** A free-slot activity abroad. */
function free(id: Id<"activity">, country: Id<"country"> | null, requires: Requirement[], entry: Pick<ActivityEntry, "cost" | "effects">): ActivityEntry {
  return {
    id,
    slot: "free",
    where: "abroad",
    country,
    requires,
    param: null,
    cost: entry.cost,
    pay: null,
    hireBp: null,
    effects: entry.effects,
    counts: [],
  };
}

/** The sponsor's or the agent's salary, a year. */
const SPONSOR_SALARY = { term: "salary" } as const;
// R-CONTRACT-002 records the Gulf salary a month: times 12 makes it a year.
const CONTRACT_SALARY = { term: "salary", bp: pct(1200) } as const;

/** The jobs a student may hold (R-LADDER-006). Overtime is not for them. */
const PART_JOBS: Id<"activity">[] = ["activity.job-uk-retail-part"];

export const abroadActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // Jobs in the UK

  "activity.job-uk-care": {
    ...job("activity.job-uk-care", "country.uk", IN_UK, { currency: "GBP", amount: SPONSOR_SALARY }, null, [], [
      wellbeing(-4),
      gain("quality.care", 1),
    ]),
    // £3,000 a year for the visiting round, while you have the car (R-LADDER-004).
    carBonus: pounds(3000),
  },
  "activity.job-uk-senior-care": {
    ...job(
      "activity.job-uk-senior-care",
      "country.uk",
      IN_UK,
      { currency: "GBP", amount: pounds(29000) },
      pct(25),
      [
        { type: "quality/min", quality: "quality.care", value: 60 },
        { type: "activity/tenure", activities: ["activity.job-uk-care"], months: 24 },
      ],
      [wellbeing(-4), gain("quality.standing", 1)],
    ),
    sponsor: true,
  },
  "activity.job-uk-nurse": {
    // The band 5 nurse.
    ...job(
      "activity.job-uk-nurse",
      "country.uk",
      IN_UK,
      { currency: "GBP", amount: pounds(31300) },
      pct(40),
      [{ type: "document/held", document: "document.nmc-pin" }],
      [wellbeing(-5), gain("quality.care", 1), gain("quality.standing", 2)],
    ),
    sponsor: true,
  },
  "activity.job-uk-skilled": job(
    "activity.job-uk-skilled",
    "country.uk",
    IN_UK,
    { currency: "GBP", amount: SPONSOR_SALARY },
    null,
    [],
    [wellbeing(-4), gain("quality.tech", 1)],
  ),
  "activity.job-uk-senior-dev": {
    ...job(
      "activity.job-uk-senior-dev",
      "country.uk",
      IN_UK,
      { currency: "GBP", amount: pounds(62000) },
      pct(20),
      [
        { type: "quality/min", quality: "quality.tech", value: 85 },
        { type: "activity/local-tenure", months: 24 },
      ],
      [wellbeing(-4), gain("quality.tech", 1)],
    ),
    sponsor: true,
  },
  // The survival job.
  "activity.job-uk-warehouse": job(
    "activity.job-uk-warehouse",
    "country.uk",
    IN_UK,
    { currency: "GBP", amount: pounds(23000) },
    pct(60),
    [],
    [wellbeing(-5)],
  ),
  // The student job: 20 hours at £12.21 an hour, about £10,400 a year.
  "activity.job-uk-retail-part": {
    ...job(
      "activity.job-uk-retail-part",
      "country.uk",
      IN_UK,
      { currency: "GBP", amount: pounds(10400) },
      pct(55),
      [],
      [wellbeing(-3)],
    ),
    part: true,
  },
  // The first professional job. The page's "sponsor at 70% of these employers" has no
  // field: it is not a sponsor job (reported).
  "activity.job-uk-graduate": job(
    "activity.job-uk-graduate",
    "country.uk",
    IN_UK,
    { currency: "GBP", amount: pounds(30000) },
    pct(20),
    [
      // A bachelor's and 12 months local, or a master's: there is no "all of" requirement,
      // so it is written as a bachelor's or more, and 12 months local or a master's.
      { type: "quality/min", quality: "quality.edu-level", value: 3 },
      {
        type: "any",
        of: [
          { type: "activity/local-tenure", months: 12 },
          { type: "quality/min", quality: "quality.edu-level", value: 4 },
        ],
      },
    ],
    [wellbeing(-3), gain("quality.network", 1), gain("quality.tech", 1)],
  ),
  // About £7 an hour on paper, paid in cash, and sometimes not at all.
  "activity.job-uk-kitchen-cash": {
    ...job(
      "activity.job-uk-kitchen-cash",
      "country.uk",
      IN_UK,
      { currency: "GBP", amount: pounds(10800) },
      pct(70),
      [],
      [wellbeing(-7), gain("quality.standing", -1)],
    ),
    cash: true,
    withheldBp: pct(15),
  },
  // On a rented account: tuning.ladder.accountRent comes off each week.
  // the page gives no wage-theft chance for it; the rent is its loss.
  "activity.job-uk-courier-cash": {
    ...job(
      "activity.job-uk-courier-cash",
      "country.uk",
      IN_UK,
      { currency: "GBP", amount: pounds(13200) },
      pct(65),
      [],
      [wellbeing(-8)],
    ),
    cash: true,
    withheldBp: 0,
  },

  // Jobs in Canada

  "activity.job-ca-warehouse": job(
    "activity.job-ca-warehouse",
    "country.canada",
    IN_CANADA,
    { currency: "CAD", amount: cad(38000) },
    pct(60),
    [],
    [wellbeing(-5)],
  ),
  // Counts for the care cut-off.
  "activity.job-ca-care-aide": job(
    "activity.job-ca-care-aide",
    "country.canada",
    IN_CANADA,
    { currency: "CAD", amount: cad(44000) },
    pct(45),
    [{ type: "quality/min", quality: "quality.care", value: 30 }],
    [wellbeing(-5), gain("quality.care", 1)],
  ),
  "activity.job-ca-professional": job(
    "activity.job-ca-professional",
    "country.canada",
    IN_CANADA,
    { currency: "CAD", amount: cad(75000) },
    pct(25),
    [
      { type: "quality/min", quality: "quality.edu-level", value: 3 },
      { type: "activity/local-tenure", months: 12 },
    ],
    [wellbeing(-3), gain("quality.network", 1)],
  ),
  "activity.job-ca-dev": job(
    "activity.job-ca-dev",
    "country.canada",
    IN_CANADA,
    { currency: "CAD", amount: cad(95000) },
    pct(20),
    [
      { type: "quality/min", quality: "quality.tech", value: 70 },
      { type: "activity/local-tenure", months: 12 },
    ],
    [wellbeing(-4), gain("quality.tech", 1)],
  ),

  // Jobs in the UAE: 12-hour shifts, accommodation included, by the agent's contract.

  "activity.job-gulf-guard": job(
    "activity.job-gulf-guard",
    "country.uae",
    IN_UAE,
    { currency: "AED", amount: CONTRACT_SALARY },
    null,
    [],
    [wellbeing(-6)],
  ),
  "activity.job-gulf-cleaner": job(
    "activity.job-gulf-cleaner",
    "country.uae",
    IN_UAE,
    { currency: "AED", amount: CONTRACT_SALARY },
    null,
    [],
    [wellbeing(-6)],
  ),

  // Italy: where the road leaves you.

  "activity.job-it-farm-cash": {
    ...job(
      "activity.job-it-farm-cash",
      "country.italy",
      IN_ITALY,
      { currency: "EUR", amount: euros(9600) },
      pct(70),
      [],
      [wellbeing(-9)],
    ),
    cash: true,
    withheldBp: pct(25),
  },

  // Free slots abroad

  // The phone is in upkeep.
  "activity.call-home": free("activity.call-home", null, [ABROAD], {
    cost: [],
    effects: [gain("quality.standing", 3), wellbeing(2)],
  }),
  // The church, the mosque, the association. One for each country with a price on the page.
  "activity.community-uk": free("activity.community-uk", "country.uk", [IN_UK], {
    cost: [{ currency: "GBP", amount: pounds(10), reason: "social" }],
    effects: [gain("quality.network", 4), wellbeing(4)],
  }),
  // With a job that is not a student's part-time job. The extra quarter of the month's
  // pay (tuning.ladder.overtimeBp) has no effect type: the activity kind pays it.
  "activity.overtime": free("activity.overtime", null, [ABROAD, { type: "job/any" }, { type: "not", of: { type: "job/is", activities: PART_JOBS } }], {
    cost: [],
    effects: [wellbeing(-8)],
  }),
  "activity.learn-tech-uk": free("activity.learn-tech-uk", "country.uk", [IN_UK], {
    cost: [{ currency: "GBP", amount: pounds(40), reason: "study" }],
    effects: [gain("quality.tech", 4), wellbeing(-2)],
  }),
  // Settlement needs B2: band 60 at least. The page prices it in pounds only.
  "activity.study-english-uk": free("activity.study-english-uk", "country.uk", [IN_UK], {
    cost: [{ currency: "GBP", amount: pounds(30), reason: "study" }],
    effects: [gain("quality.english", 6), wellbeing(-2)],
  }),
  // The NMC tests: care 60, no pin held or pending, £1,170.
  "activity.nmc-tests": free(
    "activity.nmc-tests",
    "country.uk",
    [IN_UK, { type: "quality/min", quality: "quality.care", value: 60 }, { type: "document/absent", document: "document.nmc-pin" }],
    {
      cost: [{ currency: "GBP", amount: pounds(1170), reason: "fee-test" }],
      effects: [{ type: "document/request", document: "document.nmc-pin" }],
    },
  ),
  // R-CAR-006: the lessons once (tuning.car.lessons), then the fee for each attempt
  // (tuning.car.testFee), and the pass draw. the costs depend on earlier attempts
  // and the draw has no effect type, so both belong to the kind that runs the test;
  // the entry carries neither.
  "activity.driving-test": free("activity.driving-test", "country.uk", [IN_UK, { type: "document/absent", document: "document.uk-licence" }], {
    cost: [],
    effects: [],
  }),
  // R-CAR-001: credit 30, a licence in force, the deposit of 10% of £9,500.
  "activity.buy-car-finance": free(
    "activity.buy-car-finance",
    "country.uk",
    [
      IN_UK,
      { type: "credit/min", value: 30 },
      {
        type: "any",
        of: [
          { type: "document/held", document: "document.home-licence" },
          { type: "document/held", document: "document.uk-licence" },
        ],
      },
    ],
    {
      cost: [{ currency: "GBP", amount: pounds(950), reason: "car-deposit" }],
      // The price less the deposit. The rate is set from the credit ladder (R-CREDIT-005).
      effects: [{ type: "obligation/open", obligation: "obligation.car", principal: pounds(8550) }],
    },
  ),
  // R-ABROAD-003: credit 20 and one month's rent as the deposit, returned on leaving.
  // It closes the room and opens the flat.
  "activity.rent-flat-uk": free("activity.rent-flat-uk", "country.uk", [IN_UK, { type: "credit/min", value: 20 }], {
    cost: [{ currency: "GBP", amount: pounds(950), reason: "rent" }],
    effects: [
      { type: "obligation/close", obligationType: "rent" },
      { type: "obligation/open", obligation: "obligation.rent-flat-uk" },
    ],
  }),
  // R-ABROAD-004: credit 10.
  "activity.phone-contract-uk": free(
    "activity.phone-contract-uk",
    "country.uk",
    [IN_UK, { type: "credit/min", value: 10 }],
    { cost: [], effects: [{ type: "obligation/open", obligation: "obligation.phone-uk" }] },
  ),
  "activity.phone-contract-ca": free(
    "activity.phone-contract-ca",
    "country.canada",
    [IN_CANADA, { type: "credit/min", value: 10 }],
    { cost: [], effects: [{ type: "obligation/open", obligation: "obligation.phone-ca" }] },
  ),
  // The interface's name for wallet/remit: it opens the remit sheet. Nothing happens in the slot itself.
  "activity.send-money": free("activity.send-money", null, [ABROAD], { cost: [], effects: [] }),
  // R-RETURN-005: in the December tick, the fare both ways times the December factor:
  // £620 x 2 x 2.5, C$1,350 x 2 x 2.2, AED 1,900 x 2 x 1.8 (place.md).
  // an overstayer cannot fly out and back, so not on the overstayer status; and
  // none from Italy, where the only status is irregular. The December set piece is not
  // opened: `setpiece/open` needs a route and the set piece's answers cannot carry the
  // page's money and quality effects (reported).
  "activity.december-home-uk": free(
    "activity.december-home-uk",
    "country.uk",
    [IN_UK, { type: "var/min", var: "var.season-december", value: 1 }, { type: "not", of: { type: "status/is", statuses: ["status.uk-overstayer"] } }],
    {
      cost: [{ currency: "GBP", amount: pounds(3100), reason: "fare" }],
      effects: [gain("quality.standing", 12), wellbeing(6)],
    },
  ),
};

/**
 * The free-slot activities priced in Canadian dollars or dirhams. they are
 * not joined into the activity table yet. The wallet kind keeps naira, pound and dollar
 * pockets only until R-ABROAD-001 is built, and the view's affordability check would
 * read a pocket that is not there. activity.data.ts joins them when it is built; the
 * content tests check them here until then.
 */
export const foreignPocketActivityTable: Record<Id<"activity">, ActivityEntry> = {
  "activity.community-ca": free("activity.community-ca", "country.canada", [IN_CANADA], {
    cost: [{ currency: "CAD", amount: cad(15), reason: "social" }],
    effects: [gain("quality.network", 4), wellbeing(4)],
  }),
  "activity.community-uae": free("activity.community-uae", "country.uae", [IN_UAE], {
    cost: [{ currency: "AED", amount: aed(20), reason: "social" }],
    effects: [gain("quality.network", 4), wellbeing(4)],
  }),
  "activity.learn-tech-ca": free("activity.learn-tech-ca", "country.canada", [IN_CANADA], {
    cost: [{ currency: "CAD", amount: cad(60), reason: "study" }],
    effects: [gain("quality.tech", 4), wellbeing(-2)],
  }),
  "activity.rent-flat-ca": free("activity.rent-flat-ca", "country.canada", [IN_CANADA, { type: "credit/min", value: 20 }], {
    cost: [{ currency: "CAD", amount: cad(1700), reason: "rent" }],
    effects: [
      { type: "obligation/close", obligationType: "rent" },
      { type: "obligation/open", obligation: "obligation.rent-flat-ca" },
    ],
  }),
  "activity.december-home-ca": free(
    "activity.december-home-ca",
    "country.canada",
    [IN_CANADA, { type: "var/min", var: "var.season-december", value: 1 }, { type: "not", of: { type: "status/is", statuses: ["status.ca-overstayer"] } }],
    {
      cost: [{ currency: "CAD", amount: cad(5940), reason: "fare" }],
      effects: [gain("quality.standing", 12), wellbeing(6)],
    },
  ),
  "activity.december-home-uae": free(
    "activity.december-home-uae",
    "country.uae",
    [IN_UAE, { type: "var/min", var: "var.season-december", value: 1 }, { type: "not", of: { type: "status/is", statuses: ["status.uae-irregular"] } }],
    {
      cost: [{ currency: "AED", amount: aed(6840), reason: "fare" }],
      effects: [gain("quality.standing", 12), wellbeing(6)],
    },
  ),
};
