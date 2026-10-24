// From docs/rules/activity.md, "Jobs" and "Free-slot activities", and route:visa-application-needs for the visa.
// The activities abroad are in activity.abroad.data.ts and joined in at the end.
// The gate activities are from docs/rules/route-gates.md and road.md.
import type { ActivityEntry, Cost, Id, Requirement } from "@japacity/sim";

import { dollars, naira, pct } from "../units";
import { abroadActivityTable, foreignPocketActivityTable } from "./activity.abroad.data";
import { enjoyActivityTable } from "./activity.enjoy.data";
import { calgaryActivityTable } from "./activity.calgary.data";
import { castelActivityTable } from "./activity.castel.data";
import { dubaiActivityTable } from "./activity.dubai.data";
import { londonActivityTable } from "./activity.london.data";
import { peopleActivityTable } from "./activity.person.data";
import { profileActivityTable } from "./activity.profile.data";
import { roomActivityTable } from "./activity.room.data";
import { shopActivityTable } from "./activity.shop.data";
import { streetActivityTable } from "./activity.street.data";
import { waterActivityTable } from "./activity.water.data";
import { ladderActivityTable, SUPPORT_JOBS, TEACHER_JOBS } from "./activity.ladder.data";
import { learningActivityTable } from "./activity.learning.data";
import { peopleApplyActivities } from "../route/route.data";

const UK: Id<"route"> = "route.uk-masters";
const WINDOW: Id<"var"> = "var.uk-study-window";
const CARE: Id<"route"> = "route.uk-care";
const SKILLED: Id<"route"> = "route.uk-skilled";
const CANADA: Id<"route"> = "route.canada-points";
const TALENT: Id<"route"> = "route.uk-talent";
const GULF: Id<"route"> = "route.gulf-contract";

function known(route: Id<"route">): Requirement {
  return { type: "route/state", route, in: ["known"] };
}

function windowOpen(window: Id<"var">): Requirement {
  return { type: "var/min", var: window, value: 1 };
}

function held(document: Id<"document">, min?: number): Requirement {
  return min === undefined ? { type: "document/held", document } : { type: "document/held", document, min };
}

/** The health surcharge for one year of a worker's visa, in pounds. */
const SURCHARGE_YEAR: Cost = { currency: "GBP", amount: { var: "var.uk-surcharge-year" }, reason: "fee-surcharge" };

/**
 * status:grace-allows-in-country-applications: an application made from home, or from inside the UK in an overstay's grace or in the months a
 * withdrawn student's permission is cut to (status:course-passed-or-withdrawn), with no flight. The act is `where: "any"` so it may stand
 * abroad, and this keeps it to those.
 */
const HOME_OR_UK_GRACE: Requirement = {
  type: "any",
  of: [
    { type: "place/is", where: "home" },
    { type: "status/is", statuses: ["status.uk-overstayer"], grace: true },
    { type: "status/is", statuses: ["status.uk-student"], withdrawn: true },
  ],
};
/** route:visa-application-needs, route-gates:sponsor-application-needs: the TB certificate, not asked of an application made in the UK. */
const TB_UNLESS_IN_UK: Requirement = {
  type: "any",
  of: [held("document.tb-certificate"), { type: "place/is", where: "abroad", country: "country.uk" }],
};

export const activityTable: Record<Id<"activity">, ActivityEntry> = {
  // Jobs

  "activity.job-teacher": {
    id: "activity.job-teacher",
    slot: "main",
    employer: "informal",
    requires: [{ type: "quality/min", quality: "quality.education-level", value: 3 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(90000) },
    hireBp: pct(70),
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: -2 },
      { type: "quality/add", quality: "quality.standing", amount: 1 },
    ],
    counts: [],
  },
  "activity.job-customer-service": {
    id: "activity.job-customer-service",
    slot: "main",
    employer: "formal",
    requires: [{ type: "quality/min", quality: "quality.education-level", value: 1 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(110000) },
    hireBp: pct(60),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -3 }],
    counts: [],
  },
  "activity.job-junior-developer": {
    id: "activity.job-junior-developer",
    slot: "main",
    employer: "formal",
    // Employers judge a junior by a piece of work shown (activity.md, the developer's ladder).
    requires: [
      { type: "quality/min", quality: "quality.tech", value: 30 },
      { type: "quality/min", quality: "quality.portfolio", value: 1 },
    ],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(320000) },
    hireBp: pct(35),
    effects: [
      { type: "quality/add", quality: "quality.tech", amount: 2 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
    ],
    counts: [],
  },
  "activity.job-bank-officer": {
    id: "activity.job-bank-officer",
    slot: "main",
    employer: "formal",
    // health:sick-pay-unless-sick-leave: the bank pays through a sick month.
    sickLeave: true,
    requires: [
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      { type: "quality/min", quality: "quality.education-grade", value: 3 },
    ],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(320000) },
    hireBp: pct(20),
    effects: [
      { type: "quality/add", quality: "quality.network", amount: 1 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
    ],
    counts: [],
  },
  "activity.job-bank-senior": {
    id: "activity.job-bank-senior",
    slot: "main",
    employer: "formal",
    // health:sick-pay-unless-sick-leave: the bank pays through a sick month.
    sickLeave: true,
    requires: [{ type: "activity/tenure", activities: ["activity.job-bank-officer"], months: 36 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(560000) },
    hireBp: pct(25),
    effects: [
      { type: "quality/add", quality: "quality.network", amount: 1 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
    ],
    counts: [],
  },
  "activity.job-mid-developer": {
    id: "activity.job-mid-developer",
    slot: "main",
    employer: "formal",
    requires: [
      { type: "quality/min", quality: "quality.tech", value: 60 },
      {
        type: "activity/tenure",
        activities: ["activity.job-junior-developer", "activity.job-mid-developer", "activity.job-remote-developer"],
        months: 12,
      },
    ],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(1100000) },
    hireBp: pct(30),
    effects: [
      { type: "quality/add", quality: "quality.tech", amount: 2 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -4 },
    ],
    counts: [],
  },
  "activity.job-remote-developer": {
    id: "activity.job-remote-developer",
    slot: "main",
    requires: [
      { type: "quality/min", quality: "quality.tech", value: 75 },
      { type: "quality/min", quality: "quality.portfolio", value: 3 },
      { type: "quality/min", quality: "quality.english", value: 60 },
      // Simulated play: with no tenure asked, this one job paid for 97% of flights.
      { type: "activity/tenure", activities: ["activity.job-junior-developer", "activity.job-mid-developer"], months: 6 },
    ],
    param: null,
    cost: [],
    pay: { currency: "USD", amount: dollars(2800) },
    hireBp: pct(10),
    effects: [
      { type: "quality/add", quality: "quality.tech", amount: 1 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -5 },
    ],
    counts: [],
  },

  // The nurse's job (route-gates.md, the last table): a staff nurse at ₦180,000 a month.
  // A nurse starts at care 60, so that is what it needs, and its month is a care job's:
  // wellbeing -4, care +1. The nurse from sixteen hunts it at the clinic (prologue:archetype-presets-answers).
  // Its hiring chance is 50%, between the teacher's 70% and the junior developer's 35%:
  // the wards are short of nurses.
  "activity.job-nurse": {
    id: "activity.job-nurse",
    slot: "main",
    employer: "formal",
    requires: [{ type: "quality/min", quality: "quality.care", value: 60 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(180000) },
    hireBp: pct(50),
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: -4 },
      { type: "quality/add", quality: "quality.care", amount: 1 },
    ],
    counts: [],
  },

  // Free-slot activities

  "activity.rest": {
    id: "activity.rest",
    slot: "free",
    // At home and abroad (ladders.md).
    where: "any",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    // The same figure as tuning.quality.wellbeingRest, which an empty slot uses (turn:free-slots-per-month).
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: 12 }],
    counts: [],
  },
  // Gist with Mama: talking takes no time, as often as you like (activity:acts-may-repeat-in-month).
  "activity.family-time": {
    id: "activity.family-time",
    slot: "free",
    when: "now",
    repeat: true,
    halfDays: 0,
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.standing", amount: 1 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 2 },
    ],
    counts: [],
  },
  "activity.job-hunt": {
    id: "activity.job-hunt",
    slot: "free",
    // At home and abroad, filtered by the status's work rule (ladders.md).
    where: "any",
    requires: [],
    param: "job",
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "activity/hunt" }],
    counts: [],
  },
  // A day of study, paid and answered at once; three in a month give what the month's slot gave (activity:acts-may-repeat-in-month).
  "activity.study-english": {
    id: "activity.study-english",
    slot: "free",
    when: "now",
    repeat: true,
    halfDays: 2,
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(3000), reason: "study" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.english", amount: 2 },
      { type: "quality/add", quality: "quality.energy", amount: -3 },
    ],
    counts: [UK],
  },
  "activity.learn-tech": {
    id: "activity.learn-tech",
    slot: "free",
    when: "now",
    repeat: true,
    halfDays: 2,
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(5000), reason: "study" }],
    pay: null,
    hireBp: null,
    // activity:study-days-capped: a share of the free path's month by band for each day, the activity kind's to give.
    effects: [{ type: "quality/add", quality: "quality.energy", amount: -3 }],
    bandGains: [3, 2, 1],
    counts: [],
  },
  // A piece for the portfolio: a weekend at the laptop, up at once (activity:acts-may-repeat-in-month).
  "activity.build-portfolio": {
    id: "activity.build-portfolio",
    slot: "free",
    when: "now",
    repeat: true,
    halfDays: 4,
    requires: [{ type: "quality/min", quality: "quality.tech", value: 40 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.portfolio", amount: 1 },
      { type: "quality/add", quality: "quality.tech", amount: 1 },
      { type: "quality/add", quality: "quality.energy", amount: -5 },
    ],
    counts: [],
  },
  "activity.side-gig": {
    id: "activity.side-gig",
    slot: "free",
    requires: [{ type: "quality/min", quality: "quality.tech", value: 25 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "activity/gig", min: naira(30000), max: naira(90000), perTech: naira(1000) },
      { type: "quality/add", quality: "quality.wellbeing", amount: -4 },
    ],
    counts: [],
  },
  "activity.meetup": {
    id: "activity.meetup",
    slot: "free",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(10000), reason: "social" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.network", amount: 5 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 2 },
      { type: "route/hear", route: UK, chanceBp: pct(40), via: "meetup" },
      // route-gates.md: the talent route is heard of at a meetup, 20%.
      { type: "route/hear", route: TALENT, chanceBp: pct(20), via: "meetup" },
      // guide:first-meetup-hears-fitting-route: a life with care 30 (the care route's own bar to hear) hears of health care at the meetup.
      // No chance is given for it, so none is drawn and the offer stream keeps its walk.
      { type: "route/hear", route: CARE, via: "meetup" },
    ],
    counts: [],
  },
  "activity.look-into-route": {
    id: "activity.look-into-route",
    slot: "free",
    // The param offers every route heard of (route:looking-into-makes-known), so no one route is named here.
    requires: [],
    param: "route",
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/look-into" }],
    counts: [],
  },
  "activity.get-passport": {
    id: "activity.get-passport",
    slot: "free",
    requires: [{ type: "document/absent", document: "document.passport" }],
    param: null,
    // ₦100,000 at the start, read from the world so the director can double it (news.passport-fee-doubles).
    cost: [{ currency: "NGN", amount: { var: "var.passport-fee" }, reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.passport" }],
    counts: [UK],
  },
  // document:degree-english-statement: asked from the Papers app with a bachelor's degree, for good once held.
  "activity.degree-english": {
    id: "activity.degree-english",
    slot: "free",
    requires: [
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      { type: "document/absent", document: "document.degree-english" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(150000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.degree-english" }],
    counts: [SKILLED, CARE],
  },
  "activity.get-transcript": {
    id: "activity.get-transcript",
    slot: "free",
    requires: [
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      { type: "document/absent", document: "document.transcript" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(25000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.transcript" }],
    counts: [UK],
  },
  "activity.sit-english-test": {
    id: "activity.sit-english-test",
    slot: "free",
    requires: [
      { type: "document/held", document: "document.passport" },
      { type: "not", of: { type: "document/pending", document: "document.english-test" } },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(295000), reason: "fee-test" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.english-test" }],
    // document:who-sits-the-english-test: the routes that still ask a band; the master's English is the degree.
    counts: [CANADA, CARE, SKILLED],
  },
  "activity.apply-to-school": {
    id: "activity.apply-to-school",
    slot: "free",
    where: "any",
    // "Route known" means the state `known` only, here and for
    // interview prep and the land buyer. Applying, granted and departed are left out.
    requires: [
      { type: "route/state", route: UK, in: ["known"] },
      { type: "var/min", var: WINDOW, value: 1 },
      { type: "document/held", document: "document.passport" },
      { type: "document/held", document: "document.transcript" },
      HOME_OR_UK_GRACE,
    ],
    param: "school",
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply-school" }],
    counts: [UK],
  },
  "activity.family-meeting": {
    id: "activity.family-meeting",
    slot: "free",
    // route-gates:family-gift-counts-with-deed: a school's offer for the master's, or a Canada plan with the credential assessment held.
    requires: [
      {
        type: "any",
        of: [
          { type: "route/offer", route: UK },
          { type: "not", of: { type: "any", of: [{ type: "not", of: known(CANADA) }, { type: "not", of: held("document.eca") }] } },
        ],
      },
      { type: "quality/min", quality: "quality.standing", value: 30 },
      { type: "quality/max", quality: "quality.family-stake", value: 0 },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    // Each pledge has its own standing band, and the gift asks the Canada plan picked (decision 0022), so at most one of these opens.
    effects: [
      { type: "offer/open", offer: "offer.family-pledge" },
      { type: "offer/open", offer: "offer.family-pledge-small" },
      { type: "offer/open", offer: "offer.family-gift-canada" },
    ],
    counts: [UK, CANADA],
  },
  // The family's loan (the passbook's family road): a call to Papa from home, once
  // the life stands well with the house and the house has something to give. No deadline, so nothing is charged; the
  // house's stake in the move is its price, and a life whose family already pledged has asked once.
  "activity.ask-family-loan": {
    id: "activity.ask-family-loan",
    slot: "free",
    requires: [
      { type: "place/is", where: "home" },
      { type: "quality/min", quality: "quality.standing", value: 40 },
      { type: "quality/min", quality: "quality.family-means", value: 10 },
      { type: "quality/max", quality: "quality.family-stake", value: 0 },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "offer/open", offer: "offer.family-loan" }],
    counts: [],
  },
  "activity.tb-test": {
    id: "activity.tb-test",
    slot: "free",
    requires: [
      { type: "document/held", document: "document.passport" },
      { type: "document/absent", document: "document.tb-certificate" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(120000), reason: "fee-test" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.tb-certificate" }],
    counts: [UK],
  },
  // document:police-certificate-for-routes: the police certificate, asked at the visa centre's notice, since no police station is built.
  "activity.get-police-certificate": {
    id: "activity.get-police-certificate",
    slot: "free",
    requires: [{ type: "document/absent", document: "document.police-certificate" }],
    param: null,
    cost: [{ currency: "NGN", amount: naira(5000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.police-certificate" }],
    counts: [CANADA, SKILLED, CARE, GULF],
  },
  "activity.interview-prep": {
    id: "activity.interview-prep",
    slot: "free",
    requires: [{ type: "route/state", route: UK, in: ["known"] }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "quality/add", quality: "quality.interview-prep", amount: 20 }],
    counts: [UK],
  },
  "activity.apply-for-visa": {
    id: "activity.apply-for-visa",
    slot: "free",
    where: "any",
    // route:visa-application-needs, item by item. route:degree-meets-masters-english: the degree is the English, which the route is heard of by.
    requires: [
      { type: "route/state", route: UK, in: ["known"] },
      { type: "var/min", var: WINDOW, value: 1 },
      HOME_OR_UK_GRACE,
      { type: "route/deposit", route: UK },
      { type: "document/held", document: "document.passport" },
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      TB_UNLESS_IN_UK,
      { type: "document/held", document: "document.cas" },
      { type: "route/funds", route: UK, heldMonths: 1 },
    ],
    param: null,
    cost: [
      { currency: "GBP", amount: { var: "var.uk-visa-fee" }, reason: "fee-visa" },
      { currency: "GBP", amount: { var: "var.uk-surcharge" }, reason: "fee-surcharge" },
    ],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply", route: UK }],
    counts: [UK],
  },

  // Side jobs (activity:side-job-holds-a-slot): hunted like a job, held beside it, one free slot locked while kept.
  // The contract's pay names no pocket; naira pay goes to cash and dollar pay to the bank.

  // Tied to the trade: at its pay for any life it would be a second road to the dollar for everyone (activity.md, Side jobs).
  "activity.night-support": {
    id: "activity.night-support",
    slot: "side",
    requires: [
      { type: "quality/min", quality: "quality.english", value: 60 },
      { type: "any", of: [{ type: "activity/tenure", activities: SUPPORT_JOBS, months: 6 }, { type: "quality/min", quality: "quality.tech", value: 40 }] },
    ],
    param: null,
    cost: [],
    pay: { currency: "USD", amount: dollars(250) },
    // activity:side-jobs-pay-by-tier: strong English takes the harder calls. Half shifts of the real $400 to $600.
    tiers: [{ needs: [{ type: "quality/min", quality: "quality.english", value: 75 }], pay: { currency: "USD", amount: dollars(350) } }],
    hireBp: pct(30),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -6 }],
    counts: [],
  },
  // The teacher's side job: home lessons, the exam coaching tier for a teacher of two years.
  "activity.weekend-tutoring": {
    id: "activity.weekend-tutoring",
    slot: "side",
    requires: [{ type: "quality/min", quality: "quality.education-level", value: 3 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(80000) },
    // activity:side-jobs-pay-by-tier, the page's own example. Real: ₦64,400 a month for three children's lessons in Lekki.
    tiers: [
      {
        needs: [
          { type: "quality/min", quality: "quality.english", value: 70 },
          { type: "activity/tenure", activities: TEACHER_JOBS, months: 24 },
        ],
        pay: { currency: "NGN", amount: naira(120000) },
      },
    ],
    hireBp: pct(50),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -4 }],
    counts: [],
  },
  "activity.ride-driving": {
    id: "activity.ride-driving",
    slot: "side",
    requires: [{ type: "quality/min", quality: "quality.driving", value: 1 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(120000) },
    // activity:side-jobs-pay-by-tier: regular riders and an office account come through people. Working values.
    tiers: [
      { needs: [{ type: "quality/min", quality: "quality.network", value: 70 }], pay: { currency: "NGN", amount: naira(150000) } },
      { needs: [{ type: "quality/min", quality: "quality.network", value: 85 }], pay: { currency: "NGN", amount: naira(180000) } },
    ],
    hireBp: pct(45),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -7 }],
    counts: [],
  },

  // The counter-moves to the one chance (activity:one-chance-bus-robbery).

  "activity.safe-ride": {
    id: "activity.safe-ride",
    slot: "free",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(25000), reason: "upkeep" }],
    pay: null,
    hireBp: null,
    effects: [],
    counts: [],
  },
  "activity.sleep-at-office": {
    id: "activity.sleep-at-office",
    slot: "free",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: -4 },
      { type: "quality/add", quality: "quality.standing", amount: -1 },
    ],
    counts: [],
  },

  // The kiosk (luck:kiosk-sells-lotto-tickets, luck:bet-slip-stake-and-odds). The tickets, the stake and the draws are tuning, so the
  // activity kind prices and draws them; the entries carry no cost and no effect.

  "activity.play-lotto": {
    id: "activity.play-lotto",
    slot: "free",
    // lottery:draw-runs-online-only: the kiosk closes while the world runs the Friday draw.
    requires: [{ type: "world/lottery", online: false }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [],
    counts: [],
  },
  "activity.bet-slip": {
    id: "activity.bet-slip",
    slot: "free",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [],
    counts: [],
  },

  ...abroadActivityTable,
  // The wallet keeps Canadian dollar and dirham pockets (abroad-money:foreign-currencies-join-wallet).
  ...foreignPocketActivityTable,
  // person.md: time with someone (person:time-together-is-an-act).
  ...peopleActivityTable,
  // streets.md: Computer Village, the bridge and the stadium (streets:buy-phone-at-computer-village, streets:phone-sales-job, streets:apprentice-learns-repair, streets:sleeping-under-the-bridge, streets:stadium-morning-run).
  ...streetActivityTable,
  // obligation:cooking-and-fetching-water: the room's basics, cooking and water.
  ...roomActivityTable,
  // streets:lagos-street-spending: the street's enjoyment and spending (decision 0012).
  ...enjoyActivityTable,
  // place:country-pass-covers-ways and streets:london-life-by-hand: London lived by hand.
  ...londonActivityTable,
  // place:country-pass-covers-ways and streets:calgary-life-by-hand, streets:dubai-life-by-hand and streets:castel-volturno-by-hand: Calgary, Dubai and Castel Volturno lived by hand.
  ...calgaryActivityTable,
  ...dubaiActivityTable,
  ...castelActivityTable,
  // activity:waiting-months-build-profile: the waiting months' acts.
  ...profileActivityTable,
  // The trader's own shop.
  ...shopActivityTable,
  // The fish racks at Makoko (activity:fish-racks-at-makoko).
  ...waterActivityTable,
  // activity:each-trade-climbs-its-ladder: the trades' rungs and side jobs, and own work opened with its capital (activity:capital-opens-own-work).
  ...ladderActivityTable,
  // quality:skill-bands-slow-gains: learning tech in bands, and the trades' papers (document:trade-papers).
  ...learningActivityTable,
  // person.md: applying on the partner and dependant gates (person:dependant-gate-needs, person:partner-gate-needs).
  ...peopleApplyActivities,
  // route-gates.md: the sponsor gate.

  "activity.find-sponsor": {
    id: "activity.find-sponsor",
    slot: "free",
    where: "home",
    // A requirement cannot read the param, so this needs either sponsor route known. The route
    // picked must also have its window open, which the route kind checks (route-gates:sponsor-offers-come-up).
    requires: [{ type: "any", of: [known(CARE), known(SKILLED)] }],
    param: "known-route",
    cost: [],
    pay: null,
    hireBp: null,
    // No effect in the contract rolls a sponsor offer, so the route kind runs route-gates:sponsor-offers-come-up for the
    // route picked, with the route's `sponsor.findBp`. Nothing is listed here.
    effects: [],
    counts: [CARE, SKILLED],
  },
  "activity.request-verification": {
    id: "activity.request-verification",
    slot: "free",
    where: "home",
    // 24 months in a nursing job, the council's rule since 1 Mar 2024 (route-gates:care-route-needs-verification).
    requires: [
      { type: "activity/tenure", activities: ["activity.job-nurse"], months: 24 },
      held("document.nursing-licence"),
      { type: "document/absent", document: "document.nmcn-verification" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(66875), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.nmcn-verification" }],
    counts: [CARE],
  },
  "activity.renew-licence": {
    id: "activity.renew-licence",
    slot: "free",
    where: "home",
    // Only a nurse renews. Care 40 is well under what every nurse holds (the prologue's leave with 60);
    // a renewal already being made blocks another (document:one-pending-copy keeps the held one in force meanwhile).
    requires: [
      { type: "quality/min", quality: "quality.care", value: 40 },
      { type: "not", of: { type: "document/pending", document: "document.nursing-licence" } },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(25000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.nursing-licence" }],
    counts: [CARE],
  },
  "activity.apply-uk-care": {
    id: "activity.apply-uk-care",
    slot: "free",
    where: "any",
    // route-gates:sponsor-application-needs and route-gates:care-route-needs-verification. Each gate route has its own apply activity, as apply-for-visa is the study route's.
    requires: [
      known(CARE),
      // route-gates:nurses-sponsored-while-care-shut: the window open, or a trust's post recorded, which may sponsor a nurse with it shut.
      { type: "route/gate-step", route: CARE, step: "open" },
      { type: "route/gate-step", route: CARE, step: "sponsor" },
      { type: "route/gate-step", route: CARE, step: "salary" },
      held("document.nursing-licence"),
      held("document.nmcn-verification"),
      // route-gates:sponsor-application-needs: the degree's English statement, or band 5.5.
      { type: "any", of: [held("document.degree-english"), held("document.english-test", 55)] },
      TB_UNLESS_IN_UK,
      held("document.passport"),
      HOME_OR_UK_GRACE,
    ],
    param: null,
    // The care route is exempt from the surcharge.
    cost: [{ currency: "GBP", amount: { var: "var.uk-care-visa-fee" }, reason: "fee-visa" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply", route: CARE }],
    counts: [CARE],
  },
  "activity.apply-uk-skilled": {
    id: "activity.apply-uk-skilled",
    slot: "free",
    where: "any",
    // route-gates:sponsor-application-needs and route-gates:skilled-route-needs-degree.
    requires: [
      known(SKILLED),
      windowOpen("var.uk-skilled-window"),
      { type: "route/gate-step", route: SKILLED, step: "sponsor" },
      { type: "route/gate-step", route: SKILLED, step: "salary" },
      { type: "quality/min", quality: "quality.education-level", value: 3 },
      { type: "activity/tenure", activities: [], months: 24 },
      { type: "any", of: [held("document.degree-english"), held("document.english-test", 55)] },
      TB_UNLESS_IN_UK,
      held("document.passport"),
      HOME_OR_UK_GRACE,
      { type: "route/funds", route: SKILLED, heldMonths: 1 },
    ],
    param: null,
    // The surcharge for the status's 36 months is three years of `var.uk-surcharge-year`, one cost each,
    // because an amount read from the world cannot be scaled.
    cost: [
      { currency: "GBP", amount: { var: "var.uk-skilled-visa-fee" }, reason: "fee-visa" },
      SURCHARGE_YEAR,
      SURCHARGE_YEAR,
      SURCHARGE_YEAR,
    ],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply", route: SKILLED }],
    counts: [SKILLED],
  },

  // route-gates.md: the points gate.

  "activity.get-eca": {
    id: "activity.get-eca",
    slot: "free",
    where: "home",
    // Only once the points route is known, so the list does not offer it to everyone.
    requires: [
      known(CANADA),
      { type: "document/absent", document: "document.eca" },
    ],
    param: null,
    // C$329, paid as a foreign fee.
    cost: [{ currency: "CAD", amount: { var: "var.canada-eca-fee" }, reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.eca" }],
    counts: [CANADA],
  },
  // route-gates:family-gift-counts-with-deed: the notary's deed for the family's gift, ₦20,000 and a month (working values, not verified).
  "activity.gift-deed": {
    id: "activity.gift-deed",
    slot: "free",
    where: "home",
    requires: [{ type: "route/gate-step", route: CANADA, step: "gift" }, { type: "document/absent", document: "document.gift-deed" }],
    param: null,
    cost: [{ currency: "NGN", amount: naira(20000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.gift-deed" }],
    counts: [CANADA],
  },
  "activity.enter-pool": {
    id: "activity.enter-pool",
    slot: "free",
    where: "home",
    // route-gates:entering-the-pool. Band 6.0 is CLB 7; `route/funds` asks for the funds.
    requires: [
      known(CANADA),
      windowOpen("var.canada-window"),
      held("document.eca"),
      held("document.english-test", 60),
      { type: "activity/tenure", activities: [], months: 12 },
      { type: "route/funds", route: CANADA, heldMonths: 0 },
      { type: "not", of: { type: "route/gate-step", route: CANADA, step: "pool" } },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/enter-pool", route: CANADA }],
    counts: [CANADA],
  },

  // route-gates.md: the endorsement gate.

  "activity.apply-endorsement": {
    id: "activity.apply-endorsement",
    slot: "free",
    where: "home",
    // route-gates:applying-for-endorsement. The six months after a refusal are the route's `endorsement.cooldown`.
    requires: [
      known(TALENT),
      windowOpen("var.uk-talent-window"),
      { type: "quality/min", quality: "quality.tech", value: 75 },
      { type: "quality/min", quality: "quality.portfolio", value: 3 },
      { type: "quality/min", quality: "quality.network", value: 50 },
      { type: "document/absent", document: "document.endorsement" },
      // route-gates:endorsement-decided-by-draw: six months after a refused endorsement.
      { type: "route/gate-step", route: TALENT, step: "cooled" },
    ],
    param: null,
    cost: [{ currency: "GBP", amount: { var: "var.uk-talent-endorse-fee" }, reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.endorsement" }],
    counts: [TALENT],
  },
  "activity.apply-uk-talent": {
    id: "activity.apply-uk-talent",
    slot: "free",
    where: "home",
    // route-gates:talent-visa-needs-endorsement.
    requires: [
      known(TALENT),
      windowOpen("var.uk-talent-window"),
      held("document.endorsement"),
      held("document.passport"),
      held("document.tb-certificate"),
    ],
    param: null,
    // The surcharge for 60 months: five years, one cost each.
    cost: [
      { currency: "GBP", amount: { var: "var.uk-talent-visa-fee" }, reason: "fee-visa" },
      SURCHARGE_YEAR,
      SURCHARGE_YEAR,
      SURCHARGE_YEAR,
      SURCHARGE_YEAR,
      SURCHARGE_YEAR,
    ],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply", route: TALENT }],
    counts: [TALENT],
  },

  // route-gates.md: the contract gate, and road.md for the motor park.

  "activity.ask-around": {
    id: "activity.ask-around",
    slot: "free",
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    // The motor park hears of the Gulf (route-gates:gulf-route-heard-at-park) and the pitch finds the curious (road:pitch-rises-with-pressure). A life that heard of the
    // Gulf already (the drivers at the send-off) looks it into here first: the look-into moves only a route heard, so its place
    // before the hearing is the condition (decision 0001; chapter:chapters-follow-lean-route's reading).
    effects: [
      { type: "route/look-into", route: GULF },
      { type: "route/hear", route: GULF, via: "motor-park" },
      { type: "offer/open", offer: "offer.road-park" },
    ],
    counts: [],
  },
  "activity.gulf-medical": {
    id: "activity.gulf-medical",
    slot: "free",
    where: "home",
    // Only once the contract route is known.
    requires: [
      { type: "route/state", route: GULF, in: ["known"] },
      { type: "document/absent", document: "document.medical" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(60000), reason: "fee-test" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.medical" }],
    counts: [GULF],
  },
  "activity.apply-gulf-contract": {
    id: "activity.apply-gulf-contract",
    slot: "free",
    where: "home",
    // route-gates:gulf-application-needs: secondary school or better and under 45 years. No fee: the employer pays.
    requires: [
      known(GULF),
      windowOpen("var.uae-window"),
      { type: "route/gate-step", route: GULF, step: "sponsor" },
      held("document.passport"),
      held("document.medical"),
      { type: "quality/min", quality: "quality.education-level", value: 1 },
      { type: "quality/max", quality: "quality.age-months", value: 539 },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply", route: GULF }],
    counts: [GULF],
  },
};
