// From docs/rules/activity.md, "Jobs" and "Free-slot activities", and R-ROUTE-012 for the visa.
// The activities abroad are in activity.abroad.data.ts and joined in at the end.
import type { ActivityEntry, Id } from "@japacity/sim";

import { dollars, naira, pct } from "../units";
import { abroadActivityTable } from "./activity.abroad.data";

const UK: Id<"route"> = "route.uk-masters";
const WINDOW: Id<"var"> = "var.uk-study-window";

export const activityTable:Record<Id<"activity">, ActivityEntry> = {
  // Jobs

  "activity.job-teacher": {
    id: "activity.job-teacher",
    slot: "main",
    requires: [{ type: "quality/min", quality: "quality.edu-level", value: 3 }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(75000) },
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
    ],
    param: null,
    cost: [],
    pay: { currency: "USD", amount: dollars(2800) },
    hireBp: pct(15),
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
    ],
    counts: [],
  },
  "activity.look-into-route": {
    id: "activity.look-into-route",
    slot: "free",
    // a requirement cannot read the param, so this names the one route
    // outright. Accepted for this milestone, which has one route.
    requires: [{ type: "route/state", route: UK, in: ["heard"] }],
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
    cost: [{ currency: "NGN", amount: naira(100000), reason: "fee-document" }],
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

  ...abroadActivityTable,
};
