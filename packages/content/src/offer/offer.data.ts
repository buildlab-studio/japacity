// From docs/rules/offer.md: "Family requests", "Life" and "Money".
import type { Id, OfferEntry, Requirement } from "@japacity/sim";

import { naira, pct } from "../units";

const UK: Id<"route"> = "route.uk-masters";

/** "Not when broke": at least ₦150,000 in naira, bank and cash together. */
const NOT_BROKE: Requirement = { type: "money/min", currency: "NGN", amount: naira(150000) };

const CREDIT_CLEAN: Requirement = { type: "quality/max", quality: "quality.credit-mark", value: 0 };
const SIX_MONTHS_IN_ANY_JOB: Requirement = { type: "activity/tenure", activities: [], months: 6 };

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
    // the page gives no lapse choice for the pledges. Read as nothing
    // happening; lapsing into `decline` (standing -2) is the other reading.
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
    // offer.md lists this under "Money", group `money`, but the
    // contract has a `job` group and nothing else could use it. It is never
    // rolled, so the group changes nothing in R-OFFER-001's order.
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
};
