// The offers of life abroad and of coming home: docs/rules/return.md R-RETURN-003
// and ladders.md R-LADDER-005. Joined into the offer table in offer.data.ts.
//
// the pages name these offers and what each is about, but give no chance,
// cooldown, terms or choices. Every number here is a working value for the sweep.
// R-RETURN-003's 12-month window and "the shape of the last return" have no
// requirement type. Each returnee offer comes up while home after the send-off;
// tuning.return.offerMonths is left for the offer kind to apply.
import type { Id, OfferEntry, Requirement } from "@japacity/sim";

import { naira, pct } from "../units";

/** Home again after the send-off: a return has happened. */
const RETURNED: Requirement[] = [
  { type: "place/is", where: "home" },
  { type: "chapter/done", chapter: "chapter.send-off" },
];

export const abroadOfferTable: Record<Id<"offer">, OfferEntry> = {
  // Coming home (group `return`)

  // The question everyone asks.
  "offer.returnee-question": {
    id: "offer.returnee-question",
    group: "return",
    where: "home",
    when: RETURNED,
    chanceBp: pct(30),
    cooldown: 3,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "truth",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.standing", amount: -2 },
          { type: "quality/add", quality: "quality.wellbeing", amount: 3 },
        ],
        fraudEffects: null,
      },
      {
        id: "story",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.standing", amount: 2 },
          { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
        ],
        fraudEffects: null,
      },
      {
        id: "shrug",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -1 }],
        fraudEffects: null,
      },
    ],
    onExpire: "shrug",
  },

  // A cousin with a shop idea. Sometimes the shop is real.
  "offer.returnee-business": {
    id: "offer.returnee-business",
    group: "return",
    where: "home",
    when: RETURNED,
    chanceBp: pct(8),
    cooldown: 6,
    maxTimes: 2,
    expiresAfter: 2,
    terms: { stake: { from: "range", min: naira(1000000), max: naira(3000000), step: naira(500000) } },
    fraudBp: pct(40),
    signs: [
      { key: "shop-seen", honestBp: pct(70), fraudBp: pct(20) },
      { key: "this-week", honestBp: pct(30), fraudBp: pct(80) },
      { key: "notebook", honestBp: pct(60), fraudBp: pct(30) },
    ],
    choices: [
      {
        id: "invest",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "stake" }, reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: 5 },
          { type: "quality/add", quality: "quality.network", amount: 3 },
        ],
        // The money goes and the shop never opens.
        fraudEffects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "stake" }, reason: "family" },
          { type: "quality/add", quality: "quality.standing", amount: -2 },
          { type: "quality/add", quality: "quality.wellbeing", amount: -8 },
        ],
      },
      {
        id: "decline",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.standing", amount: -2 }],
        fraudEffects: null,
      },
    ],
    onExpire: "decline",
  },

  // A company that wants the foreign experience. It hires for what you can show.
  "offer.returnee-hire": {
    id: "offer.returnee-hire",
    group: "return",
    where: "home",
    when: RETURNED,
    chanceBp: pct(10),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 2,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "bank",
        requires: [{ type: "quality/min", quality: "quality.edu-level", value: 3 }],
        pick: null,
        effects: [{ type: "activity/start-job", job: "activity.job-bank-senior" }],
        fraudEffects: null,
      },
      {
        id: "tech",
        requires: [{ type: "quality/min", quality: "quality.tech", value: 60 }],
        pick: null,
        effects: [{ type: "activity/start-job", job: "activity.job-mid-dev" }],
        fraudEffects: null,
      },
      {
        id: "decline",
        requires: [],
        pick: null,
        effects: [],
        fraudEffects: null,
      },
    ],
    onExpire: "decline",
  },

  // A friend's connection: the way out, again.
  "offer.returnee-leave-again": {
    id: "offer.returnee-leave-again",
    group: "return",
    where: "home",
    when: RETURNED,
    chanceBp: pct(6),
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "listen",
        requires: [],
        pick: null,
        effects: [
          { type: "route/hear", route: "route.uk-masters", via: "returnee" },
          { type: "quality/add", quality: "quality.network", amount: 2 },
        ],
        fraudEffects: null,
      },
      {
        id: "stay",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: 2 }],
        fraudEffects: null,
      },
    ],
    onExpire: "stay",
  },

  // Abroad (group `abroad`)

  // R-LADDER-005: the sponsor loses its licence and the job goes, which starts the clock.
  // a small base chance; the director's sponsor story raises the risk through its
  // own variable while it is in force.
  "offer.sponsor-licence-lost": {
    id: "offer.sponsor-licence-lost",
    group: "abroad",
    where: "abroad",
    when: [
      { type: "status/is", statuses: ["status.uk-sponsored"] },
      { type: "job/is", activities: ["activity.job-uk-care"] },
    ],
    // 0.5% a month.
    chanceBp: 50,
    cooldown: 12,
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
        effects: [{ type: "activity/end-job", why: "sponsor-licence" }],
        fraudEffects: null,
      },
    ],
    onExpire: "go",
  },
};
