// The luck offers of docs/rules/luck.md: the whip-round (R-LUCK-002), the telco
// promo (R-LUCK-007) and the luck native to japa (R-LUCK-010). Joined into the
// offer table in offer.data.ts. A luck offer's `when` never reads money
// (R-LUCK-001); the whip-round's money rule is the offer kind's, in the open.
import type { Id, OfferEntry, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { dollars, naira, pct, pounds } from "../units";

const UK: Id<"route"> = "route.uk-masters";

/** The formal routes. The road is left out: no relative sends money because you heard of it. */
const FORMAL_ROUTES: Id<"route">[] = ["route.uk-masters", "route.uk-care", "route.uk-skilled", "route.canada-points", "route.uk-talent", "route.gulf-contract"];

/** "Any route known": looked into, or further along. The aunty abroad has heard you are travelling, and the parcel reads it too. */
export const ANY_ROUTE_KNOWN: Requirement = {
  type: "any",
  of: FORMAL_ROUTES.map((route): Requirement => ({ type: "route/state", route, in: ["known", "applying", "granted"] })),
};

// a win left unanswered lapses into nothing. Luck has to be picked up.
export const luckOfferTable: Record<Id<"offer">, OfferEntry> = {
  // R-LUCK-002. Never rolled: the offer kind opens it once a life when its rule holds. The term
  // `rescue` is the tuning's, and the kind hands over the live tuning's figure when it opens, so an
  // overlay moves it.
  "offer.whip-round": {
    id: "offer.whip-round",
    group: "life",
    where: "home",
    luck: true,
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: 1,
    expiresAfter: 1,
    terms: { rescue: tuning.luck.rescue },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "accept",
        requires: [],
        pick: null,
        effects: [{ type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "rescue" }, reason: "gift", flagged: true }],
        fraudEffects: null,
      },
      {
        id: "decline",
        requires: [],
        pick: null,
        // Pride.
        effects: [{ type: "quality/add", quality: "quality.standing", amount: 3 }],
        fraudEffects: null,
      },
    ],
    onExpire: null,
  },

  // R-LUCK-007. The term `promo` is the tuning's, handed over live by the offer kind as for the whip-round.
  // a cooldown of 6, as the other life offers have; the page gives none.
  "offer.telco-promo": {
    id: "offer.telco-promo",
    group: "life",
    when: [],
    chanceBp: 300,
    cooldown: 6,
    maxTimes: null,
    expiresAfter: 1,
    terms: { promo: tuning.luck.promo },
    fraudBp: pct(80),
    signs: [
      { key: "shortcode", honestBp: pct(80), fraudBp: pct(20) },
      { key: "reply-now", honestBp: pct(20), fraudBp: pct(90) },
      { key: "strange-number", honestBp: pct(10), fraudBp: pct(85) },
    ],
    choices: [
      {
        id: "claim",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: naira(2000), reason: "fee-agent" },
          { type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "promo" }, reason: "gift" },
        ],
        // The fee goes and nothing follows.
        fraudEffects: [{ type: "money/take", currency: "NGN", pocket: "any", amount: naira(2000), reason: "fee-agent" }],
      },
      { id: "ignore", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: "ignore",
  },

  // R-LUCK-010: a relative abroad sends $500 to the dollar bank pocket, a gift, flagged. The sixth review
  // gives the risk a way round, said before it is taken: asked for through her bank with a note, the
  // gift is documented and not flagged. the brief has it land a month later; no effect credits
  // money a month on, so it lands now.
  "offer.relative-sends": {
    id: "offer.relative-sends",
    group: "life",
    luck: true,
    when: [ANY_ROUTE_KNOWN],
    chanceBp: 400,
    cooldown: 9,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "thank",
        requires: [],
        pick: null,
        effects: [{ type: "money/add", currency: "USD", pocket: "bank", amount: dollars(500), reason: "gift", flagged: true }],
        fraudEffects: null,
      },
      {
        id: "note",
        requires: [],
        pick: null,
        effects: [{ type: "money/add", currency: "USD", pocket: "bank", amount: dollars(500), reason: "gift" }],
        fraudEffects: null,
      },
    ],
    onExpire: null,
  },

  // R-LUCK-010: a thirteenth month from the job, in the December tick. one month's pay is
  // the pay term at its figure of one, valued in naira at the official rate as every pay term is
  // (R-OFFER-002), and paid to the naira bank.
  "offer.december-bonus": {
    id: "offer.december-bonus",
    group: "life",
    luck: true,
    when: [{ type: "job/any" }, { type: "var/min", var: "var.season-december", value: 1 }],
    chanceBp: 3000,
    cooldown: 11,
    maxTimes: null,
    expiresAfter: 1,
    terms: { pay: { from: "pay", times: 1, cap: naira(20000000) } },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "take",
        requires: [],
        pick: null,
        effects: [{ type: "money/add", currency: "NGN", pocket: "bank", amount: { term: "pay" }, reason: "salary" }],
        fraudEffects: null,
      },
    ],
    onExpire: null,
  },

  // R-LUCK-010: a school offer held on the UK master's, in the route's window. The page's 
  // £3,000 to the pound bank pocket, a gift, not flagged, since a scholarship letter explains it.
  // once a life.
  "offer.scholarship-round": {
    id: "offer.scholarship-round",
    group: "life",
    luck: true,
    when: [
      { type: "route/offer", route: UK },
      { type: "var/min", var: "var.uk-study-window", value: 1 },
    ],
    chanceBp: pct(15),
    cooldown: 12,
    maxTimes: 1,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "accept",
        requires: [],
        pick: null,
        effects: [{ type: "money/add", currency: "GBP", pocket: "bank", amount: pounds(3000), reason: "gift" }],
        fraudEffects: null,
      },
    ],
    onExpire: null,
  },
};
