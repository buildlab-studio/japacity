// From docs/rules/people.md "Entries: activities and offers" (R-PEOPLE-038, R-PEOPLE-050).
// Joined into the offer table in offer.data.ts.
//
// taking the papers offer carries a `people/moment` of kind
// `wedding`, which the people kind reads as the papers marriage, since no
// effect opens a bond.
import type { Id, OfferEntry, Requirement } from "@japacity/sim";

import { naira, pct } from "../units";

const AGE_21: Requirement = { type: "quality/min", quality: "quality.age-months", value: 252 };
const NO_PARTNER: Requirement = { type: "not", of: { type: "people/bond", role: "partner", stages: ["partner", "married"] } };

export const peopleOfferTable: Record<Id<"offer">, OfferEntry> = {
  "offer.people-recovery": {
    id: "offer.people-recovery",
    group: "life",
    when: [],
    // Opened only by R-PEOPLE-038.
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 2,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "go",
        requires: [],
        pick: null,
        effects: [
          { type: "quality/add", quality: "quality.wellbeing", amount: 6 },
          { type: "quality/add", quality: "quality.network", amount: 2 },
        ],
        fraudEffects: null,
      },
      { id: "alone", requires: [], pick: null, effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: 2 }], fraudEffects: null },
    ],
    onExpire: null,
  },
  "offer.papers-marriage": {
    id: "offer.papers-marriage",
    group: "money",
    where: "home",
    when: [{ type: "place/is", where: "home" }, AGE_21, NO_PARTNER],
    // the page rolls it at 1%, but a new roll moves every later draw on `offer`, and the recorded lives replay offer ids; it opens only by effect until someone adds the lives again.
    chanceBp: 0,
    cooldown: 12,
    maxTimes: null,
    expiresAfter: 1,
    terms: { fee: { from: "range", min: naira(6000000), max: naira(12000000), step: naira(500000) } },
    fraudBp: pct(30),
    signs: [
      { key: "cash-only", honestBp: pct(40), fraudBp: pct(90) },
      { key: "no-meeting", honestBp: pct(90), fraudBp: pct(95) },
      { key: "friend", honestBp: pct(30), fraudBp: pct(10) },
    ],
    choices: [
      {
        id: "take",
        requires: [{ type: "money/min", currency: "NGN", amount: { term: "fee" }, pocket: "cash" }],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "fee" }, reason: "fee-agent" },
          { type: "people/moment", kind: "wedding" },
        ],
        fraudEffects: [{ type: "money/take", currency: "NGN", pocket: "cash", amount: { term: "fee" }, reason: "fee-agent" }],
      },
      { id: "walk-away", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: null,
  },
};
