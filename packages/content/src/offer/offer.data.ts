// From docs/rules/offer.md: "Family requests", "Life" and "Money"; route-gates.md
// for the sponsor offers and the Gulf agent; road.md for the road's pitches. The offers of life
// abroad and of coming home are in offer.abroad.data.ts and joined in at the end.
import type { Id, OfferChoice, OfferEntry, Requirement } from "@japacity/sim";

import { naira, pct, pounds } from "../units";
import { abroadOfferTable } from "./offer.abroad.data";

const UK: Id<"route"> = "route.uk-masters";

/** "Not when broke": at least ₦150,000 in naira, bank and cash together. */
const NOT_BROKE: Requirement = { type: "money/min", currency: "NGN", amount: naira(150000) };

const CREDIT_CLEAN: Requirement = { type: "quality/max", quality: "quality.credit-mark", value: 0 };
const SIX_MONTHS_IN_ANY_JOB: Requirement = { type: "activity/tenure", activities: [], months: 6 };

/** A sponsor or agent comes up while its route is known and its window is not closed (R-SPONSOR-001, R-CONTRACT-002). */
function sponsorWhen(route: Id<"route">, window: Id<"var">): Requirement[] {
  return [
    { type: "place/is", where: "home" },
    { type: "route/state", route, in: ["known"] },
    { type: "var/min", var: window, value: 1 },
  ];
}

const DECLINE: OfferChoice = { id: "decline", requires: [], pick: null, effects: [], fraudEffects: null };

/**
 * Taking a sponsor records it (R-SPONSOR-002). A real sponsor costs nothing; a fraud takes its fee from cash.
 * `salary: 0` means the route kind reads the offer's `salary` term from the cause, because the
 * effect's salary is a fixed number and the salary is a draw.
 */
function takeSponsor(route: Id<"route">, employer: string): OfferChoice {
  const record = { type: "route/record-sponsor", route, employer, salary: 0 } as const;
  return {
    id: "take",
    requires: [],
    pick: null,
    effects: [{ ...record, fraud: false }],
    fraudEffects: [
      { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "fee" }, reason: "fee-agent" },
      { ...record, fraud: true },
    ],
  };
}

// road.md

/** How the pitch's chance moves with the character's situation (R-ROAD-002). */
const ROAD_PRESSURE = { refusalBp: 200, defaultBp: 300, lowStandingBp: 200, perYearOver30Bp: 100, strongRouteBp: 400 };

/** What a pitch really is (R-ROAD-003). They add up to 10000. */
const ROAD_KINDS = { fraud: 3000, realish: 1000, road: 6000 };

/** Every character at home, until the chain has begun (R-ROAD-012). */
const ROAD_WHEN: Requirement[] = [
  { type: "place/is", where: "home" },
  { type: "route/state", route: "route.road", in: ["unknown", "heard", "known"] },
];

/**
 * Taking the pitch pays the deposit from cash. the offer's own fraud draw is the `fraud` kind, so
 * `fraudBp` is the fraud share and a fraud's money is simply gone; the road kind splits the rest into real-ish
 * and road. Both of those open the night meeting.
 */
const ROAD_TAKE: OfferChoice = {
  id: "take",
  requires: [],
  pick: null,
  effects: [
    { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "deposit" }, reason: "fee-agent" },
    { type: "setpiece/open", setpiece: "setpiece.road-night", route: "route.road" },
  ],
  fraudEffects: [{ type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "deposit" }, reason: "fee-agent" }],
};

const ROAD_IGNORE: OfferChoice = { id: "ignore", requires: [], pick: null, effects: [], fraudEffects: null };

export const offerTable: Record<Id<"offer">, OfferEntry> = {
  // Family requests

  "offer.nepa-bill": {
    id: "offer.nepa-bill",
    group: "family",
    when: [NOT_BROKE],
    chanceBp: pct(12),
    cooldown: 3,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "pay",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(25000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 3 },
        ],
        fraudEffects: null,
      },
      {
        id: "leave",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.standing", amount: -4 },
          { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
        ],
        fraudEffects: null,
      },
    ],
    onExpire: "leave",
  },
  "offer.brother-fees": {
    id: "offer.brother-fees",
    group: "family",
    when: [NOT_BROKE],
    chanceBp: pct(6),
    cooldown: 4,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "pay",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(120000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 8 },
        ],
        fraudEffects: null,
      },
      {
        id: "half",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(60000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 2 },
        ],
        fraudEffects: null,
      },
      {
        id: "no",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -9 }],
        fraudEffects: null,
      },
    ],
    onExpire: "no",
  },
  "offer.mum-shop": {
    id: "offer.mum-shop",
    group: "family",
    when: [NOT_BROKE],
    chanceBp: pct(5),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "give",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(80000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 6 },
        ],
        fraudEffects: null,
      },
      {
        id: "half",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(40000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 2 },
        ],
        fraudEffects: null,
      },
      {
        id: "no",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -6 }],
        fraudEffects: null,
      },
    ],
    onExpire: "no",
  },
  "offer.aso-ebi": {
    id: "offer.aso-ebi",
    group: "family",
    when: [NOT_BROKE],
    chanceBp: pct(5),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "buy",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(60000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 4 },
          { type: "quality/add", quality: "quality.network", amount: 3 },
          { type: "quality/add", quality: "quality.wellbeing", amount: 3 },
        ],
        fraudEffects: null,
      },
      {
        id: "plain",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.standing", amount: -2 },
          { type: "quality/add", quality: "quality.network", amount: 1 },
        ],
        fraudEffects: null,
      },
      {
        id: "absent",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -5 }],
        fraudEffects: null,
      },
    ],
    onExpire: "absent",
  },
  "offer.roof": {
    id: "offer.roof",
    group: "family",
    when: [NOT_BROKE],
    // 2.5%
    chanceBp: 250,
    cooldown: 12,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "pay",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(200000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 10 },
        ],
        fraudEffects: null,
      },
      {
        id: "half",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(100000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 3 },
        ],
        fraudEffects: null,
      },
      {
        id: "no",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -8 }],
        fraudEffects: null,
      },
    ],
    onExpire: "no",
  },
  "offer.harvest": {
    id: "offer.harvest",
    group: "family",
    when: [NOT_BROKE],
    chanceBp: pct(6),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "give",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(30000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 3 },
          { type: "quality/add", quality: "quality.wellbeing", amount: 2 },
        ],
        fraudEffects: null,
      },
      {
        id: "no",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -1 }],
        fraudEffects: null,
      },
    ],
    onExpire: "no",
  },
  "offer.uncle-burial": {
    id: "offer.uncle-burial",
    group: "family",
    when: [NOT_BROKE],
    // 2.5%
    chanceBp: 250,
    cooldown: 12,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "send",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(100000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 7 },
        ],
        fraudEffects: null,
      },
      {
        id: "token",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(20000), reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 1 },
        ],
        fraudEffects: null,
      },
      {
        id: "nothing",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -7 }],
        fraudEffects: null,
      },
    ],
    onExpire: "nothing",
  },

  // Life

  "offer.send-off-party": {
    id: "offer.send-off-party",
    group: "life",
    when: [{ type: "quality/min", quality: "quality.edu-level", value: 3 }],
    chanceBp: pct(5),
    cooldown: 5,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "go",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(20000), reason: "social" },
          { type: "quality/add", quality: "quality.network", amount: 4 },
          { type: "quality/add", quality: "quality.wellbeing", amount: 4 },
          { type: "route/hear", route: UK, via: "friend" },
        ],
        fraudEffects: null,
      },
      { id: "message", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: "message",
  },
  "offer.laptop-fault": {
    id: "offer.laptop-fault",
    group: "life",
    when: [{ type: "quality/min", quality: "quality.tech", value: 25 }],
    chanceBp: pct(3),
    cooldown: 8,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "repair",
        requires: [],
        pick: null,
        effects: [{ type: "money/take", currency: "NGN", pocket: "any", amount: naira(85000), reason: "mishap" }],
        fraudEffects: null,
      },
      {
        id: "manage",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.tech", amount: -2 },
          { type: "quality/add", quality: "quality.wellbeing", amount: -6 },
        ],
        fraudEffects: null,
      },
    ],
    onExpire: "manage",
  },
  "offer.fuel-scarcity": {
    id: "offer.fuel-scarcity",
    group: "life",
    when: [],
    chanceBp: pct(4),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "pay",
        requires: [],
        pick: null,
        effects: [{ type: "money/take", currency: "NGN", pocket: "any", amount: naira(30000), reason: "upkeep" }],
        fraudEffects: null,
      },
      {
        id: "trek",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -7 }],
        fraudEffects: null,
      },
    ],
    onExpire: "trek",
  },
  "offer.recruiter-message": {
    id: "offer.recruiter-message",
    group: "life",
    when: [{ type: "quality/min", quality: "quality.tech", value: 50 }, { type: "job/any" }],
    chanceBp: pct(3),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "do-it",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.portfolio", amount: 1 },
          { type: "quality/add", quality: "quality.network", amount: 3 },
          { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
        ],
        fraudEffects: null,
      },
      { id: "ignore", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: "ignore",
  },

  // Money. The page says nothing of lapsing for these, so a lapse does nothing.

  "offer.salary-loan": {
    id: "offer.salary-loan",
    group: "money",
    when: [{ type: "job/any" }, SIX_MONTHS_IN_ANY_JOB, CREDIT_CLEAN],
    chanceBp: pct(8),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      min: naira(100000),
      max: { from: "pay", times: 4, cap: naira(3000000) },
    },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "take",
        requires: [],
        pick: { minTerm: "min", maxTerm: "max" },
        // Opening the loan credits the money (R-OBLIGATION-006).
        effects: [{ type: "obligation/open", obligation: "obligation.salary-loan", principal: { term: "amount" } }],
        fraudEffects: null,
      },
      { id: "no", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },
  "offer.quick-loan": {
    id: "offer.quick-loan",
    group: "money",
    when: [{ type: "not", of: { type: "money/min", currency: "NGN", amount: naira(100000) } }, CREDIT_CLEAN],
    chanceBp: pct(25),
    cooldown: 3,
    maxTimes: null,
    expiresAfter: 1,
    terms: {
      min: naira(50000),
      max: { from: "range", min: naira(100000), max: naira(300000), step: naira(50000) },
    },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "take",
        requires: [],
        pick: { minTerm: "min", maxTerm: "max" },
        effects: [{ type: "obligation/open", obligation: "obligation.quick-loan", principal: { term: "amount" } }],
        fraudEffects: null,
      },
      { id: "ignore", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },
  "offer.held-funds": {
    id: "offer.held-funds",
    group: "money",
    when: [
      { type: "route/deposit", route: UK },
      { type: "job/any" },
      SIX_MONTHS_IN_ANY_JOB,
      { type: "quality/min", quality: "quality.standing", value: 40 },
      CREDIT_CLEAN,
    ],
    chanceBp: pct(100),
    cooldown: 2,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      min: naira(2000000),
      max: { from: "pay", times: 12, cap: naira(30000000) },
    },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "take",
        requires: [],
        pick: { minTerm: "min", maxTerm: "max" },
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "amount", bp: pct(1) }, reason: "fee-agent" },
          { type: "obligation/open", obligation: "obligation.held-funds", principal: { term: "amount" } },
        ],
        fraudEffects: null,
      },
      { id: "no", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },
  "offer.held-funds-agent": {
    id: "offer.held-funds-agent",
    group: "money",
    when: [{ type: "route/deposit", route: UK }],
    chanceBp: pct(35),
    cooldown: 4,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      min: naira(2000000),
      max: naira(40000000),
    },
    fraudBp: pct(35),
    signs: [
      { key: "cash-only", honestBp: pct(30), fraudBp: pct(90) },
      { key: "office", honestBp: pct(80), fraudBp: pct(25) },
      { key: "receipt", honestBp: pct(70), fraudBp: pct(20) },
      { key: "my-guy", honestBp: pct(30), fraudBp: pct(70) },
      { key: "friend", honestBp: pct(50), fraudBp: pct(10) },
    ],
    choices: [
      {
        id: "take",
        requires: [],
        pick: { minTerm: "min", maxTerm: "max" },
        effects: [
          { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "amount", bp: pct(4) }, reason: "fee-agent" },
          { type: "obligation/open", obligation: "obligation.held-funds-agent", principal: { term: "amount" } },
        ],
        fraudEffects: [
          { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "amount", bp: pct(4) }, reason: "fee-agent" },
        ],
      },
      { id: "walk-away", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },
  "offer.land-buyer": {
    id: "offer.land-buyer",
    group: "money",
    when: [
      { type: "quality/min", quality: "quality.land", value: 1 },
      { type: "route/state", route: UK, in: ["known"] },
    ],
    chanceBp: pct(20),
    cooldown: 3,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      price: { from: "range", min: naira(7500000), max: naira(10500000), step: naira(500000) },
    },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "sell",
        requires: [],
        pick: null,
        effects: [
          { type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "price" }, reason: "sale", flagged: true },
          { type: "quality/add", quality: "quality.land", amount: -1 },
          { type: "quality/add", quality: "quality.standing", amount: -3 },
        ],
        fraudEffects: null,
      },
      { id: "hold", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },
  "offer.family-pledge": {
    id: "offer.family-pledge",
    group: "money",
    when: [{ type: "quality/min", quality: "quality.standing", value: 50 }],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: 1,
    expiresAfter: 3,
    terms: {
      show: { from: "quality", quality: "quality.family-means", times: naira(300000) },
      gift: { from: "quality", quality: "quality.family-means", times: naira(60000) },
    },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "accept",
        requires: [],
        pick: null,
        effects: [
          { type: "route/support", route: UK, currency: "NGN", amount: { term: "show" } },
          { type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "gift" }, reason: "gift", flagged: true },
          { type: "quality/add", quality: "quality.family-stake", amount: 1 },
        ],
        fraudEffects: null,
      },
      {
        id: "decline",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -2 }],
        fraudEffects: null,
      },
    ],
    // Both family pledges lapse into nothing (R-OFFER-005).
    onExpire: null,
  },
  "offer.family-pledge-small": {
    id: "offer.family-pledge-small",
    group: "money",
    when: [
      { type: "quality/min", quality: "quality.standing", value: 30 },
      { type: "quality/max", quality: "quality.standing", value: 49 },
    ],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: 1,
    expiresAfter: 3,
    terms: {
      show: { from: "quality", quality: "quality.family-means", times: naira(150000) },
      gift: { from: "quality", quality: "quality.family-means", times: naira(30000) },
    },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "accept",
        requires: [],
        pick: null,
        effects: [
          { type: "route/support", route: UK, currency: "NGN", amount: { term: "show" } },
          { type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "gift" }, reason: "gift", flagged: true },
          { type: "quality/add", quality: "quality.family-stake", amount: 1 },
        ],
        fraudEffects: null,
      },
      {
        id: "decline",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -2 }],
        fraudEffects: null,
      },
    ],
    onExpire: null,
  },
  "offer.job": {
    id: "offer.job",
    // A hunt lands at home and abroad (R-LADDER-001).
    where: "any",
    // group `job`, as the contract allows. offer.md is fixed later,
    // which lists it under "Money". It is never rolled, so R-OFFER-001's order is unchanged.
    group: "job",
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 2,
    // The term `job` arrives with the effect that opens it (R-OFFER-007).
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      { id: "accept", requires: [], pick: null, effects: [{ type: "activity/start-job", job: { term: "job" } }], fraudEffects: null },
      { id: "decline", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },

  ...abroadOfferTable,
  // route-gates.md, "Entries: sponsor offers". group `money`, as the Gulf agent is, so R-OFFER-001 rolls them.

  "offer.sponsor-care-home": {
    id: "offer.sponsor-care-home",
    group: "money",
    where: "home",
    when: [...sponsorWhen("route.uk-care", "var.uk-care-window")],
    chanceBp: pct(8),
    cooldown: 3,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      // Pence a year: £25,000 to £29,000 by £500.
      salary: { from: "range", min: pounds(25000), max: pounds(29000), step: pounds(500) },
      // Only a fraud asks for it.
      fee: naira(4500000),
    },
    fraudBp: pct(25),
    signs: [
      { key: "pays-for-cos", honestBp: pct(10), fraudBp: pct(85) },
      { key: "licensed-register", honestBp: pct(85), fraudBp: pct(20) },
      { key: "video-interview", honestBp: pct(80), fraudBp: pct(30) },
      { key: "whatsapp-only", honestBp: pct(15), fraudBp: pct(75) },
      { key: "start-date", honestBp: pct(70), fraudBp: pct(20) },
    ],
    choices: [takeSponsor("route.uk-care", "care-home"), DECLINE],
    onExpire: "decline",
  },
  "offer.sponsor-trust": {
    id: "offer.sponsor-trust",
    group: "money",
    where: "home",
    // "Needs care 60" is read as a condition for the offer coming up.
    when: [
      ...sponsorWhen("route.uk-care", "var.uk-care-window"),
      { type: "quality/min", quality: "quality.care", value: 60 },
    ],
    chanceBp: pct(3),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 2,
    // A nurse's band: £31,300 a year.
    terms: { salary: pounds(31300) },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "take",
        requires: [],
        pick: null,
        effects: [{ type: "route/record-sponsor", route: "route.uk-care", employer: "trust", salary: pounds(31300), fraud: false }],
        fraudEffects: null,
      },
      DECLINE,
    ],
    onExpire: "decline",
  },
  "offer.sponsor-tech-firm": {
    id: "offer.sponsor-tech-firm",
    group: "money",
    where: "home",
    when: [
      ...sponsorWhen("route.uk-skilled", "var.uk-skilled-window"),
      { type: "quality/min", quality: "quality.tech", value: 60 },
    ],
    chanceBp: pct(4),
    cooldown: 4,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      // £42,000 to £60,000 by £1,000.
      salary: { from: "range", min: pounds(42000), max: pounds(60000), step: pounds(1000) },
      fee: naira(6000000),
    },
    fraudBp: pct(15),
    signs: [
      { key: "pays-for-cos", honestBp: pct(5), fraudBp: pct(80) },
      { key: "licensed-register", honestBp: pct(90), fraudBp: pct(25) },
      { key: "video-interview", honestBp: pct(90), fraudBp: pct(40) },
      { key: "whatsapp-only", honestBp: pct(10), fraudBp: pct(70) },
      { key: "start-date", honestBp: pct(80), fraudBp: pct(30) },
    ],
    choices: [takeSponsor("route.uk-skilled", "tech-firm"), DECLINE],
    onExpire: "decline",
  },
  "offer.sponsor-agency": {
    id: "offer.sponsor-agency",
    group: "money",
    where: "home",
    when: [...sponsorWhen("route.uk-skilled", "var.uk-skilled-window")],
    chanceBp: pct(6),
    cooldown: 3,
    maxTimes: null,
    expiresAfter: 1,
    terms: {
      // £38,000 to £45,000 by £500: often under the bar, which the view says.
      salary: { from: "range", min: pounds(38000), max: pounds(45000), step: pounds(500) },
      fee: naira(5000000),
    },
    fraudBp: pct(50),
    // "the same five signs" are the tech firm's, the row above on the same route.
    signs: [
      { key: "pays-for-cos", honestBp: pct(5), fraudBp: pct(80) },
      { key: "licensed-register", honestBp: pct(90), fraudBp: pct(25) },
      { key: "video-interview", honestBp: pct(90), fraudBp: pct(40) },
      { key: "whatsapp-only", honestBp: pct(10), fraudBp: pct(70) },
      { key: "start-date", honestBp: pct(80), fraudBp: pct(30) },
    ],
    choices: [takeSponsor("route.uk-skilled", "agency"), DECLINE],
    onExpire: "decline",
  },

  // route-gates.md, the contract gate.

  "offer.gulf-agent": {
    id: "offer.gulf-agent",
    group: "money",
    where: "home",
    when: [...sponsorWhen("route.gulf-contract", "var.uae-window")],
    chanceBp: pct(10),
    cooldown: 4,
    maxTimes: null,
    expiresAfter: 2,
    terms: {
      fee: { from: "range", min: naira(900000), max: naira(1800000), step: naira(100000) },
      // Fils a month: AED 1,500 to AED 2,200 by AED 100.
      salary: { from: "range", min: 150000, max: 220000, step: 10000 },
      // a term is a number, so the role is 1 for guard and 2 for cleaner.
      role: { from: "range", min: 1, max: 2, step: 1 },
    },
    fraudBp: pct(40),
    signs: [
      { key: "office", honestBp: pct(75), fraudBp: pct(25) },
      { key: "receipt", honestBp: pct(70), fraudBp: pct(15) },
      { key: "contract-paper", honestBp: pct(80), fraudBp: pct(20) },
      { key: "pay-today", honestBp: pct(20), fraudBp: pct(85) },
      { key: "friend", honestBp: pct(40), fraudBp: pct(10) },
    ],
    choices: [
      {
        id: "take",
        requires: [],
        pick: null,
        // The fee is paid either way (R-CONTRACT-002); only the record knows the difference.
        effects: [
          { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "fee" }, reason: "fee-agent" },
          { type: "route/record-sponsor", route: "route.gulf-contract", employer: "gulf-agent", salary: 0, fraud: false },
        ],
        fraudEffects: [
          { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "fee" }, reason: "fee-agent" },
          { type: "route/record-sponsor", route: "route.gulf-contract", employer: "gulf-agent", salary: 0, fraud: true },
        ],
      },
      { id: "walk-away", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: "walk-away",
  },

  // road.md, "Entries". Every pitch has the same kinds and the same pressure (R-ROAD-002 and 003).

  "offer.road-radio": {
    id: "offer.road-radio",
    group: "road",
    where: "home",
    pressure: ROAD_PRESSURE,
    kinds: ROAD_KINDS,
    when: ROAD_WHEN,
    chanceBp: 300,
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 2,
    // The promise, "Europe, three weeks", is words, not a number: it is in the body.
    terms: { deposit: { from: "range", min: naira(400000), max: naira(800000), step: naira(100000) } },
    fraudBp: ROAD_KINDS.fraud,
    signs: [
      { key: "too-cheap", honestBp: pct(90), fraudBp: pct(95) },
      { key: "no-paper", honestBp: pct(85), fraudBp: pct(90) },
      { key: "agency-warning", honestBp: pct(60), fraudBp: pct(60) },
    ],
    choices: [ROAD_TAKE, ROAD_IGNORE],
    onExpire: "ignore",
  },
  "offer.road-park": {
    id: "offer.road-park",
    group: "road",
    where: "home",
    pressure: ROAD_PRESSURE,
    kinds: ROAD_KINDS,
    when: ROAD_WHEN,
    chanceBp: 500,
    cooldown: 4,
    maxTimes: null,
    expiresAfter: 1,
    terms: { deposit: { from: "range", min: naira(400000), max: naira(800000), step: naira(100000) } },
    fraudBp: ROAD_KINDS.fraud,
    // `too-cheap` and `no-paper` keep the radio pitch's chances, as the page names them without figures here.
    signs: [
      { key: "too-cheap", honestBp: pct(90), fraudBp: pct(95) },
      { key: "no-paper", honestBp: pct(85), fraudBp: pct(90) },
      { key: "cash-today", honestBp: pct(80), fraudBp: pct(95) },
      { key: "returnee-said", honestBp: pct(40), fraudBp: pct(40) },
    ],
    choices: [ROAD_TAKE, ROAD_IGNORE],
    onExpire: "ignore",
  },
  "offer.road-cousin": {
    id: "offer.road-cousin",
    group: "road",
    where: "home",
    pressure: ROAD_PRESSURE,
    kinds: ROAD_KINDS,
    when: ROAD_WHEN,
    chanceBp: 200,
    cooldown: 12,
    maxTimes: null,
    expiresAfter: 2,
    // steps of ₦100,000, as the radio pitch's.
    terms: { deposit: { from: "range", min: naira(300000), max: naira(600000), step: naira(100000) } },
    fraudBp: ROAD_KINDS.fraud,
    signs: [
      { key: "cousin-vouches", honestBp: pct(70), fraudBp: pct(70) },
      { key: "no-paper", honestBp: pct(85), fraudBp: pct(90) },
    ],
    choices: [ROAD_TAKE, ROAD_IGNORE],
    onExpire: "ignore",
  },
  "offer.road-ransom-call": {
    id: "offer.road-ransom-call",
    group: "road",
    where: "any",
    // Opened only by the compound's `held` outcome (R-ROAD-006).
    when: [{ type: "place/is", where: "road" }],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    // steps of ₦100,000.
    terms: { sum: { from: "range", min: naira(500000), max: naira(2000000), step: naira(100000) } },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "pay",
        requires: [],
        pick: null,
        // the family pays. Family means fall 12, the middle sum (₦1,250,000) over ₦100,000 as R-ROAD-005
        // reads it for calling home; standing falls 5 as it does there. An amount on a quality cannot follow the term.
        effects: [
          { type: "quality/add", quality: "quality.family-means", amount: -12 },
          { type: "quality/add", quality: "quality.standing", amount: -5 },
        ],
        fraudEffects: null,
      },
      {
        id: "cannot",
        requires: [],
        pick: null,
        // the sum becomes debt only here, when nobody pays it.
        effects: [
          { type: "obligation/open", obligation: "obligation.agent-debt", principal: { term: "sum" } },
          { type: "quality/add", quality: "quality.wellbeing", amount: -10 },
        ],
        fraudEffects: null,
      },
    ],
    onExpire: "cannot",
  },
};
