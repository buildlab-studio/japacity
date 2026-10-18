// From docs/rules/obligation.md, "Entries", and for life abroad from
// abroad-money.md, credit.md and car.md.
import type { Currency, Effect, Id, ObligationEntry } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { aed, cad, euros, naira, pct, pounds } from "../units";

// abroad-money.md gives no figures for a missed month of upkeep or rent
// abroad, so both take what a missed month of upkeep takes at home.
const MISSED_MONTH: Effect[] = [
  { type: "quality/add", quality: "quality.standing", amount: -3 },
  { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
];

/** The phone's pay as you go in one country, food and fares lived by hand (R-ABROAD-003). */
function upkeepAbroad(id: Id<"obligation">, currency: Currency, amount: number): ObligationEntry {
  return {
    id,
    type: "upkeep",
    where: "abroad",
    currency,
    amount,
    rateBp: 0,
    term: null,
    sink: "upkeep",
    interestSink: "upkeep",
    grace: 0,
    onMiss: MISSED_MONTH,
    onDefault: [],
  };
}

/**
 * A shared room, no credit needed (R-ABROAD-003). It reports to the file: the
 * first on-time rent is the first mark that closes chapter 5's `file` item.
 * A room has nowhere cheaper to evict to, so a default here does nothing
 * more than R-CREDIT-002's default figure.
 */
function rentRoom(id: Id<"obligation">, currency: Currency, amount: number): ObligationEntry {
  return {
    id,
    type: "rent",
    where: "abroad",
    currency,
    reportsToCredit: true,
    amount,
    rateBp: 0,
    term: null,
    sink: "rent",
    interestSink: "rent",
    // Two misses in a row cost standing and wellbeing; the third is the default.
    grace: 2,
    onMiss: MISSED_MONTH,
    onDefault: [],
  };
}

/** A flat in your own name: credit 20 to open, a third miss in a row evicts to a room (R-ABROAD-003). */
function rentFlat(id: Id<"obligation">, currency: Currency, amount: number, room: Id<"obligation">): ObligationEntry {
  return {
    ...rentRoom(id, currency, amount),
    creditMin: 20,
    onDefault: [
      { type: "obligation/close", obligationType: "rent" },
      { type: "obligation/open", obligation: room },
    ],
  };
}

/**
 * A phone contract: credit 10 to open, the cheapest way to build the file (R-ABROAD-004).
 * The page's 24 months has no field on a fixed charge; the contract rolls on
 * monthly after it, as UK contracts do (an open question in abroad-money.md). A
 * default cuts the line, the page giving nothing for a miss beyond the credit file.
 */
function phone(id: Id<"obligation">, currency: Currency, amount: number): ObligationEntry {
  return {
    id,
    type: "phone",
    where: "abroad",
    currency,
    creditMin: 10,
    reportsToCredit: true,
    amount,
    rateBp: 0,
    term: null,
    sink: "phone",
    interestSink: "phone",
    grace: 2,
    onMiss: [],
    onDefault: [{ type: "obligation/close", obligationType: "phone" }],
  };
}

export const obligationTable: Record<Id<"obligation">, ObligationEntry> = {
  "obligation.upkeep": {
    id: "obligation.upkeep",
    type: "upkeep",
    currency: "NGN",
    // The scenario sets the monthly charge.
    amount: 0,
    rateBp: 0,
    term: null,
    sink: "upkeep",
    // No interest is ever charged; the contract still needs a reason.
    interestSink: "upkeep",
    grace: 0,
    onMiss: [
      { type: "quality/add", quality: "quality.standing", amount: -3 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
    ],
    onDefault: [],
  },
  // home.md: the room on the lagoon, in place of the family's upkeep while the character lives there (R-HOME-002).
  "obligation.upkeep-makoko": {
    id: "obligation.upkeep-makoko",
    type: "upkeep",
    currency: "NGN",
    amount: tuning.home.makokoUpkeep,
    rateBp: 0,
    term: null,
    sink: "upkeep",
    interestSink: "upkeep",
    grace: 0,
    onMiss: [
      { type: "quality/add", quality: "quality.standing", amount: -3 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
    ],
    onDefault: [],
  },
  // home.md R-HOME-010: the room in a compound. Its upkeep is food, light and water on your own, in place of the
  // family's upkeep while the character lives there.
  "obligation.upkeep-compound": {
    id: "obligation.upkeep-compound",
    type: "upkeep",
    currency: "NGN",
    amount: tuning.home.compound.upkeep,
    rateBp: 0,
    term: null,
    sink: "upkeep",
    interestSink: "upkeep",
    grace: 0,
    onMiss: MISSED_MONTH,
    onDefault: [],
  },
  // home.md R-HOME-010, R-HOME-011, obligation.md R-OBLIGATION-015: the year's rent, paid upfront on moving in, so the
  // next year's falls due twelve months on. A missed year's rent is asked for each month; the third miss in a row is
  // the default: the landlord takes the room back, and the home kind sends the character back to the family house in
  // the same month (R-HOME-011). The Lagos landlord keeps no credit file.
  "obligation.rent-compound": {
    id: "obligation.rent-compound",
    type: "rent",
    currency: "NGN",
    everyMonths: 12,
    prepaid: true,
    amount: tuning.home.compound.rentYear,
    rateBp: 0,
    term: null,
    sink: "rent",
    interestSink: "rent",
    grace: 2,
    onMiss: MISSED_MONTH,
    onDefault: [{ type: "obligation/close", obligationType: "rent" }],
  },
  // A hostel room's rent (decision 0018): by the month, no year's lump, which is why it is the cheap way out of the
  // family house. Its first month is paid on the move; from then each month's end pays the month to come, as the room
  // in a compound's year is paid ahead. A missed month is asked for again; the third miss in a row closes it and the
  // home kind sends the character back to the family house (R-HOME-011).
  "obligation.upkeep-hostel": {
    id: "obligation.upkeep-hostel",
    type: "rent",
    currency: "NGN",
    amount: tuning.home.hostelRentKobo,
    rateBp: 0,
    term: null,
    sink: "rent",
    interestSink: "rent",
    grace: 2,
    onMiss: MISSED_MONTH,
    onDefault: [{ type: "obligation/close", obligationType: "rent" }],
  },
  "obligation.home-support": {
    id: "obligation.home-support",
    // Support for the family follows the character abroad (R-PLACE-002, R-ABROAD-007).
    where: "any",
    type: "support",
    currency: "NGN",
    amount: 0,
    rateBp: 0,
    term: null,
    sink: "family",
    interestSink: "family",
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -6 }],
    onDefault: [],
  },
  "obligation.salary-loan": {
    id: "obligation.salary-loan",
    type: "loan",
    currency: "NGN",
    amount: 0,
    rateBp: pct(2),
    term: 12,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 1,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -4 }],
    onDefault: [
      { type: "quality/add", quality: "quality.standing", amount: -15 },
      { type: "quality/add", quality: "quality.credit-mark", amount: 1 },
    ],
  },
  "obligation.quick-loan": {
    id: "obligation.quick-loan",
    type: "loan",
    currency: "NGN",
    amount: 0,
    rateBp: pct(20),
    term: 1,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 1,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -8 }],
    onDefault: [
      { type: "quality/add", quality: "quality.standing", amount: -15 },
      { type: "quality/add", quality: "quality.credit-mark", amount: 1 },
    ],
  },
  "obligation.held-funds": {
    id: "obligation.held-funds",
    type: "held-funds",
    currency: "NGN",
    amount: 0,
    rateBp: pct(5),
    term: null,
    sink: "held-funds-return",
    interestSink: "held-funds-interest",
    // A missed month closes it at once (R-OBLIGATION-007).
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -5 }],
    onDefault: [],
  },
  "obligation.held-funds-agent": {
    id: "obligation.held-funds-agent",
    type: "held-funds",
    currency: "NGN",
    amount: 0,
    rateBp: pct(3),
    term: null,
    sink: "held-funds-return",
    interestSink: "held-funds-interest",
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -5 }],
    onDefault: [],
  },

  // obligation.md R-OBLIGATION-010 to 012: 15% over 9 months, fees and savings up front.
  "obligation.group-loan": {
    id: "obligation.group-loan",
    type: "group-loan",
    currency: "NGN",
    amount: 0,
    // 1.7% a month flat.
    rateBp: 170,
    term: 9,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 2,
    // The first step of R-OBLIGATION-011's ladder; the second is the house visit.
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -5 }],
    onDefault: [
      { type: "quality/add", quality: "quality.standing", amount: -15 },
      { type: "quality/add", quality: "quality.credit-mark", amount: 1 },
    ],
    // The laptop.
    seize: [
      { type: "quality/add", quality: "quality.tech", amount: -10 },
      { type: "quality/add", quality: "quality.portfolio", amount: -1 },
    ],
  },
  // R-OBLIGATION-012: standing guarantor. Three months on, the relative may be gone and the balance is yours.
  // The contract has no timer for this, so the guarantee is an undertaking of 3 months owing the balance.
  "obligation.guarantee": {
    id: "obligation.guarantee",
    type: "undertaking",
    currency: "NGN",
    amount: 0,
    rateBp: 0,
    term: 3,
    sink: "family",
    interestSink: "family",
    grace: 0,
    onMiss: [],
    onDefault: [{ type: "obligation/open", obligation: "obligation.group-loan", principal: { term: "outstanding" } }],
  },
  // luck.md R-LUCK-009: ₦20,000 a month for 10 months, the pot drawn on `lotto`.
  // The page names no sink for a share paid into the circle; `social` is the nearest.
  "obligation.ajo": {
    id: "obligation.ajo",
    type: "ajo",
    currency: "NGN",
    amount: naira(20000),
    rateBp: 0,
    term: 10,
    sink: "social",
    interestSink: "social",
    grace: 0,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -6 }],
    onDefault: [],
  },

  // Abroad: abroad-money.md "Entries".

  // R-ABROAD-003: in the UK food and fares are lived by hand, so the upkeep is the phone's pay as you go alone.
  "obligation.upkeep-uk": upkeepAbroad("obligation.upkeep-uk", "GBP", pounds(15)),
  // R-ABROAD-003 (design page 15 section 5): in Canada, the UAE and Italy too the upkeep is the prepaid phone alone.
  "obligation.upkeep-ca": upkeepAbroad("obligation.upkeep-ca", "CAD", cad(30)),
  "obligation.upkeep-uae": upkeepAbroad("obligation.upkeep-uae", "AED", aed(50)),
  "obligation.upkeep-it": upkeepAbroad("obligation.upkeep-it", "EUR", euros(10)),

  // SpareRoom's £668 for a room outside London, rounded as the page does.
  "obligation.rent-room-uk": rentRoom("obligation.rent-room-uk", "GBP", pounds(670)),
  "obligation.rent-room-ca": rentRoom("obligation.rent-room-ca", "CAD", cad(900)),
  // No rent while the Gulf employer houses you; this is for anyone else in the UAE.
  "obligation.rent-room-uae": rentRoom("obligation.rent-room-uae", "AED", aed(1200)),
  "obligation.rent-room-it": rentRoom("obligation.rent-room-it", "EUR", euros(350)),

  "obligation.rent-flat-uk": rentFlat("obligation.rent-flat-uk", "GBP", pounds(950), "obligation.rent-room-uk"),
  "obligation.rent-flat-ca": rentFlat("obligation.rent-flat-ca", "CAD", cad(1700), "obligation.rent-room-ca"),

  "obligation.phone-uk": phone("obligation.phone-uk", "GBP", pounds(25)),
  "obligation.phone-ca": phone("obligation.phone-ca", "CAD", cad(45)),

  // R-ABROAD-005: the tuition less the deposit and discount is the principal, opened on
  // arrival, paid in three parts in months 1, 4 and 7 of the course.
  "obligation.tuition": {
    id: "obligation.tuition",
    type: "tuition",
    where: "abroad",
    currency: "GBP",
    everyMonths: 3,
    amount: 0,
    rateBp: 0,
    term: 3,
    sink: "fee-school",
    interestSink: "fee-school",
    grace: 1,
    onMiss: [],
    // The student is withdrawn: the status lapses at once (R-STATUS-011).
    onDefault: [{ type: "status/lose" }],
  },

  // activity.md R-ACTIVITY-013: a master's at home, ₦1,800,000 in twelve monthly instalments, the
  // principal handed over by the activity's first month. The page gives no default, so the grace
  // is the whole term: fees fall behind and stay owed, and no school withdraws you from a course at home.
  "obligation.masters-at-home": {
    id: "obligation.masters-at-home",
    type: "tuition",
    where: "home",
    currency: "NGN",
    amount: 0,
    rateBp: 0,
    term: 12,
    sink: "fee-school",
    interestSink: "fee-school",
    grace: 12,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -1 }],
    onDefault: [],
  },

  // car.md "Entries": £9,500, 10% down, 36 months, 30% at the end.
  "obligation.car": {
    id: "obligation.car",
    type: "car",
    where: "abroad",
    currency: "GBP",
    creditMin: 30,
    reportsToCredit: true,
    // A month: 0.5% at 70 and up (6% a year), 0.9% from 50, 1.2% from 30 (about 15%). Under 30, none.
    rateByCredit: [
      { min: 70, rateBp: 50 },
      { min: 50, rateBp: 90 },
      { min: 30, rateBp: 120 },
    ],
    car: {
      price: pounds(9500),
      depositBp: pct(10),
      finalBp: pct(30),
      resaleBp: pct(55),
      // A third, in basis points.
      courtThirdBp: 3333,
      handBackBp: pct(50),
      courtMonths: 3,
      shortfall: "obligation.car-shortfall",
    },
    amount: 0,
    // The ladder sets the rate when the car is bought (R-CREDIT-005); the
    // entry's own rate is the bottom rung, the one a file at exactly 30 gets.
    rateBp: 120,
    term: 36,
    sink: "car-payment",
    interestSink: "loan-interest",
    // Two misses bring the notice; the third is when the car is taken (R-CAR-003).
    grace: 2,
    // The cost of a miss is the credit file (R-CREDIT-002) and the notice line.
    onMiss: [],
    onDefault: [],
  },

  // What is owed after a repossession: 12 months at 0%, opened with a judgment (R-CAR-003).
  // It follows you home (R-RETURN-006), so it applies anywhere; it reports to
  // the file and has the salary loan's grace of 1, the page giving neither.
  "obligation.car-shortfall": {
    id: "obligation.car-shortfall",
    type: "loan",
    where: "any",
    currency: "GBP",
    reportsToCredit: true,
    amount: 0,
    rateBp: 0,
    term: 12,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 1,
    onMiss: [],
    onDefault: [],
  },

  // R-RETURN-006: the car's shortfall on the way home, converted to naira at the official rate on the
  // day of the return. The same terms as the shortfall abroad.
  "obligation.car-shortfall-home": {
    id: "obligation.car-shortfall-home",
    type: "loan",
    where: "any",
    currency: "NGN",
    reportsToCredit: true,
    amount: 0,
    rateBp: 0,
    term: 12,
    sink: "loan-repay",
    interestSink: "loan-interest",
    grace: 1,
    onMiss: [],
    onDefault: [],
  },

  // road.md R-ROAD-006 and 007: the ransom nobody paid. It follows the character home or on to Italy.
  // The page gives no schedule, rate or grace, so it charges nothing a month and never defaults;
  // it stays open as what is owed.
  "obligation.agent-debt": {
    id: "obligation.agent-debt",
    type: "agent-debt",
    where: "any",
    currency: "NGN",
    amount: 0,
    rateBp: 0,
    term: null,
    sink: "agent-debt",
    interestSink: "agent-debt",
    grace: 0,
    onMiss: [],
    onDefault: [],
  },

  // docs/rules/undertaking.md "Entries": the sponsor's promise to Canada for a
  // partner, 36 months from the landing. Nothing is owed until the partner takes
  // assistance; each new month of it costs var.ca-assistance (R-UNDERTAKING-007).
  "obligation.undertaking-ca": {
    id: "obligation.undertaking-ca",
    type: "undertaking",
    // It follows the sponsor wherever they live (R-UNDERTAKING-009).
    where: "any",
    currency: "CAD",
    // Read from var.ca-assistance for each new month; no fixed charge.
    amount: 0,
    rateBp: 0,
    term: 36,
    sink: "undertaking",
    interestSink: "undertaking",
    grace: 2,
    onMiss: [{ type: "quality/add", quality: "quality.standing", amount: -3 }],
    // R-UNDERTAKING-008: the credit file takes the default figure (R-CREDIT-002).
    onDefault: [
      { type: "quality/add", quality: "quality.standing", amount: -10 },
      { type: "credit/mark", amount: -tuning.credit.onDefault },
    ],
  },
};
