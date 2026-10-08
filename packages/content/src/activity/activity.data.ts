// From docs/rules/activity.md, "Jobs" and "Free-slot activities", and R-ROUTE-012 for the visa.
// The activities abroad are in activity.abroad.data.ts and joined in at the end.
// The gate activities are from docs/rules/route-gates.md and road.md.
import type { ActivityEntry, Cost, Id, Requirement } from "@japacity/sim";

import { dollars, naira, pct } from "../units";
import { abroadActivityTable, foreignPocketActivityTable } from "./activity.abroad.data";
import { peopleActivityTable } from "./activity.people.data";

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

export const activityTable: Record<Id<"activity">, ActivityEntry> = {
  // Jobs

  "activity.job-teacher": {
    id: "activity.job-teacher",
    slot: "main",
    requires: [{ type: "quality/min", quality: "quality.edu-level", value: 3 }],
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
    requires: [{ type: "quality/min", quality: "quality.edu-level", value: 1 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(110000) },
    hireBp: pct(60),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -3 }],
    counts: [],
  },
  "activity.job-junior-dev": {
    id: "activity.job-junior-dev",
    slot: "main",
    requires: [{ type: "quality/min", quality: "quality.tech", value: 30 }],
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
    // R-HEALTH-004: the bank pays through a sick month.
    sickLeave: true,
    requires: [
      { type: "quality/min", quality: "quality.edu-level", value: 3 },
      { type: "quality/min", quality: "quality.edu-grade", value: 3 },
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
    // R-HEALTH-004: the bank pays through a sick month.
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
  "activity.job-mid-dev": {
    id: "activity.job-mid-dev",
    slot: "main",
    requires: [
      { type: "quality/min", quality: "quality.tech", value: 60 },
      {
        type: "activity/tenure",
        activities: ["activity.job-junior-dev", "activity.job-mid-dev", "activity.job-remote-dev"],
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
  "activity.job-remote-dev": {
    id: "activity.job-remote-dev",
    slot: "main",
    requires: [
      { type: "quality/min", quality: "quality.tech", value: 75 },
      { type: "quality/min", quality: "quality.portfolio", value: 3 },
      { type: "quality/min", quality: "quality.english", value: 60 },
      // The sweep: with no tenure asked, this one job paid for 97% of flights.
      { type: "activity/tenure", activities: ["activity.job-junior-dev", "activity.job-mid-dev"], months: 6 },
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

  // Ngozi's job (route-gates.md, the last table): a staff nurse at ₦180,000 a month.
  // the page names the job only on the starting life and gives no chance or
  // monthly effects. A nurse starts at care 60, so that is what it needs; it has no
  // hiring chance of its own, and its month is a care job's: wellbeing -4, care +1.
  "activity.job-nurse": {
    id: "activity.job-nurse",
    slot: "main",
    requires: [{ type: "quality/min", quality: "quality.care", value: 60 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(180000) },
    hireBp: null,
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
    // The same figure as tuning.quality.wellbeingRest, which an empty slot uses (R-TURN-006).
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: 12 }],
    counts: [],
  },
  "activity.family-time": {
    id: "activity.family-time",
    slot: "free",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.standing", amount: 4 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 4 },
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
  "activity.study-english": {
    id: "activity.study-english",
    slot: "free",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(10000), reason: "study" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.english", amount: 6 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -2 },
    ],
    counts: [UK],
  },
  "activity.learn-tech": {
    id: "activity.learn-tech",
    slot: "free",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(15000), reason: "study" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.tech", amount: 4 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -2 },
    ],
    counts: [],
  },
  "activity.build-portfolio": {
    id: "activity.build-portfolio",
    slot: "free",
    requires: [{ type: "quality/min", quality: "quality.tech", value: 40 }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.portfolio", amount: 1 },
      { type: "quality/add", quality: "quality.tech", amount: 1 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
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
    ],
    counts: [],
  },
  "activity.look-into-route": {
    id: "activity.look-into-route",
    slot: "free",
    // The param offers every route heard of (R-ROUTE-004), so no one route is named here.
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
  "activity.get-transcript": {
    id: "activity.get-transcript",
    slot: "free",
    requires: [
      { type: "quality/min", quality: "quality.edu-level", value: 3 },
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
    cost: [{ currency: "NGN", amount: naira(285500), reason: "fee-test" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.english-test" }],
    counts: [UK],
  },
  "activity.apply-to-school": {
    id: "activity.apply-to-school",
    slot: "free",
    // "Route known" means the state `known` only, here and for
    // interview prep and the land buyer. Applying, granted and departed are left out.
    requires: [
      { type: "route/state", route: UK, in: ["known"] },
      { type: "var/min", var: WINDOW, value: 1 },
      { type: "document/held", document: "document.passport" },
      { type: "document/held", document: "document.transcript" },
      { type: "document/held", document: "document.english-test" },
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
    requires: [
      { type: "route/offer", route: UK },
      { type: "quality/min", quality: "quality.standing", value: 30 },
      { type: "quality/max", quality: "quality.family-stake", value: 0 },
    ],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    // Each pledge has its own standing band, so at most one of these opens.
    effects: [
      { type: "offer/open", offer: "offer.family-pledge" },
      { type: "offer/open", offer: "offer.family-pledge-small" },
    ],
    counts: [UK],
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
    // R-ROUTE-012, item by item.
    requires: [
      { type: "route/state", route: UK, in: ["known"] },
      { type: "var/min", var: WINDOW, value: 1 },
      { type: "route/deposit", route: UK },
      { type: "document/held", document: "document.passport" },
      { type: "document/held", document: "document.english-test" },
      { type: "document/held", document: "document.tb-certificate" },
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

  // Side jobs (R-ACTIVITY-010): hunted like a job, held beside it, one free slot locked while kept.
  // the contract's pay names no pocket; naira pay goes to cash and dollar pay to the bank.

  "activity.night-support": {
    id: "activity.night-support",
    slot: "side",
    requires: [
      { type: "quality/min", quality: "quality.english", value: 50 },
      { type: "quality/min", quality: "quality.tech", value: 20 },
    ],
    param: null,
    cost: [],
    pay: { currency: "USD", amount: dollars(350) },
    hireBp: pct(30),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -6 }],
    counts: [],
  },
  "activity.weekend-tutoring": {
    id: "activity.weekend-tutoring",
    slot: "side",
    requires: [{ type: "quality/min", quality: "quality.edu-level", value: 3 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(60000) },
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
    hireBp: pct(45),
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -7 }],
    counts: [],
  },

  // The counter-moves to the one chance (R-ACTIVITY-011).

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

  // The kiosk (R-LUCK-005, 006). the tickets, the stake and the draws are tuning, so the
  // activity kind prices and draws them; the entries carry no cost and no effect.

  "activity.play-lotto": {
    id: "activity.play-lotto",
    slot: "free",
    // R-LOTTERY-001: the kiosk closes while the world runs the Friday draw.
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
  // The wallet keeps Canadian dollar and dirham pockets now (R-ABROAD-001).
  ...foreignPocketActivityTable,
  // people.md: time with someone (R-PEOPLE-014).
  ...peopleActivityTable,
  // route-gates.md: the sponsor gate.

  "activity.find-sponsor": {
    id: "activity.find-sponsor",
    slot: "free",
    where: "home",
    // a requirement cannot read the param, so this needs either sponsor route known. The route
    // picked must also have its window open, which the route kind checks (R-SPONSOR-001).
    requires: [{ type: "any", of: [known(CARE), known(SKILLED)] }],
    param: "known-route",
    cost: [],
    pay: null,
    hireBp: null,
    // no effect in the contract rolls a sponsor offer, so the route kind runs R-SPONSOR-001 for the
    // route picked, with the route's `sponsor.findBp`. Nothing is listed here.
    effects: [],
    counts: [CARE, SKILLED],
  },
  "activity.request-verification": {
    id: "activity.request-verification",
    slot: "free",
    where: "home",
    // 24 months in a nursing job, the council's rule since 1 Mar 2024 (R-SPONSOR-005).
    requires: [
      { type: "activity/tenure", activities: ["activity.job-nurse"], months: 24 },
      held("document.nursing-licence"),
      { type: "document/absent", document: "document.nmcn-verification" },
    ],
    param: null,
    cost: [{ currency: "NGN", amount: naira(150000), reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.nmcn-verification" }],
    counts: [CARE],
  },
  "activity.renew-licence": {
    id: "activity.renew-licence",
    slot: "free",
    where: "home",
    // only a nurse renews. Care 40 is what the prologue's nurses leave with; a renewal already
    // being made blocks another (R-DOCUMENT-004 keeps the held one in force meanwhile).
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
    where: "home",
    // R-SPONSOR-003 and 005. each gate route has its own apply activity, as apply-for-visa is the study route's.
    requires: [
      known(CARE),
      windowOpen("var.uk-care-window"),
      { type: "route/gate-step", route: CARE, step: "sponsor" },
      { type: "route/gate-step", route: CARE, step: "salary" },
      held("document.nursing-licence"),
      held("document.nmcn-verification"),
      held("document.english-test", 40),
      held("document.tb-certificate"),
      held("document.passport"),
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
    where: "home",
    // R-SPONSOR-003 and 006.
    requires: [
      known(SKILLED),
      windowOpen("var.uk-skilled-window"),
      { type: "route/gate-step", route: SKILLED, step: "sponsor" },
      { type: "route/gate-step", route: SKILLED, step: "salary" },
      { type: "quality/min", quality: "quality.edu-level", value: 3 },
      { type: "activity/tenure", activities: [], months: 24 },
      held("document.english-test", 40),
      held("document.tb-certificate"),
      held("document.passport"),
      { type: "route/funds", route: SKILLED, heldMonths: 1 },
    ],
    param: null,
    // the surcharge for the status's 36 months is three years of `var.uk-surcharge-year`, one cost each,
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
    // only once the points route is known, so the list does not offer it to everyone.
    requires: [
      known(CANADA),
      { type: "document/absent", document: "document.eca" },
    ],
    param: null,
    // C$329, paid as a foreign fee.
    cost: [{ currency: "CAD", amount: { var: "var.ca-eca-fee" }, reason: "fee-document" }],
    pay: null,
    hireBp: null,
    effects: [{ type: "document/request", document: "document.eca" }],
    counts: [CANADA],
  },
  "activity.enter-pool": {
    id: "activity.enter-pool",
    slot: "free",
    where: "home",
    // R-POINTS-002. Band 6.0 is CLB 7; the funds are covered now.
    requires: [
      known(CANADA),
      windowOpen("var.ca-window"),
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
    // R-ENDORSE-001. The six months after a refusal are the route's `endorsement.cooldown`.
    requires: [
      known(TALENT),
      windowOpen("var.uk-talent-window"),
      { type: "quality/min", quality: "quality.tech", value: 75 },
      { type: "quality/min", quality: "quality.portfolio", value: 3 },
      { type: "quality/min", quality: "quality.network", value: 50 },
      { type: "document/absent", document: "document.endorsement" },
      // R-ENDORSE-002: six months after a refused endorsement.
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
    // R-ENDORSE-003.
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
    // The motor park hears of the Gulf (R-CONTRACT-001) and the pitch finds the curious (R-ROAD-002).
    effects: [
      { type: "route/hear", route: GULF, via: "motor-park" },
      { type: "offer/open", offer: "offer.road-park" },
    ],
    counts: [],
  },
  "activity.gulf-medical": {
    id: "activity.gulf-medical",
    slot: "free",
    where: "home",
    // only once the contract route is known.
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
    // R-CONTRACT-003: secondary school or better and under 45 years. No fee: the employer pays.
    requires: [
      known(GULF),
      windowOpen("var.uae-window"),
      { type: "route/gate-step", route: GULF, step: "sponsor" },
      held("document.passport"),
      held("document.medical"),
      { type: "quality/min", quality: "quality.edu-level", value: 1 },
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
