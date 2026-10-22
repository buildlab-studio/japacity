// The offers of life abroad and of coming home: return:returnee-offers-for-a-year
// and ladders:sponsor-job-ties-status. Joined into the offer table in offer.data.ts.
//
// The pages name these offers and what each is about, but give no chance,
// cooldown, terms or choices. Every number here is a working value for simulated play to tune.
// return:returnee-offers-for-a-year: the offer kind keeps the group `return` in the pool for
// tuning.return.offerMonths after the last return, and judges each `when`
// against that return alone, so `place/returned` reads the last return's shape.
import type { Id, OfferEntry, Requirement, ReturnShape } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { naira, pct } from "../units";
import { varTable } from "../var/var.data";

/** Home, and the last return was one of these shapes. */
function returned(shapes: ReturnShape[]): Requirement[] {
  return [
    { type: "place/is", where: "home" },
    { type: "place/returned", shapes },
  ];
}

/** streets:street-finds-abroad: a find on the street of one country; its one choice is to look. */
function streetFind(id: Id<"offer">, country: Id<"country">): OfferEntry {
  return {
    id,
    group: "life",
    where: "abroad",
    bad: false,
    when: [{ type: "place/is", where: "abroad", country }],
    chanceBp: tuning.street.findBp,
    cooldown: 2,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      { id: "look", requires: [], pick: null, effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: tuning.street.findMood }], fraudEffects: null },
      // A second answer, walking on, with nothing gained or lost.
      { id: "walk-on", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    // Left alone, the moment passes and nothing happens.
    onExpire: null,
  };
}

const lifeAbroadOffers: Record<Id<"offer">, OfferEntry> = {
  // Coming home (group `return`)

  // The question everyone asks.
  "offer.returnee-question": {
    id: "offer.returnee-question",
    group: "return",
    where: "home",
    // Everyone asks, whatever the shape.
    when: returned(["removed", "assisted", "broke", "by-choice", "with-papers"]),
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
    // The cousin comes to the ones who came back with money: papers or by choice.
    when: returned(["by-choice", "with-papers"]),
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
    // The foreign experience is on the CV of anyone who worked out there; a removal is on it too.
    when: returned(["broke", "by-choice", "with-papers"]),
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
    // The friend's connection finds the ones who came back without what they went for.
    when: returned(["assisted", "broke", "by-choice"]),
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

  // The street abroad (group `life`)

  // streets:street-finds-abroad: something interesting on the street, while the character is in that country.
  // The kind has no versions of an offer's body, so each country's find has one body.
  "offer.street-find-uk": streetFind("offer.street-find-uk", "country.uk"),
  "offer.street-find-uae": streetFind("offer.street-find-uae", "country.uae"),
  // Calgary's strip mall and Castel Volturno's roundabout have theirs on the same pattern (city.md "Entries: abroad", design page 11).
  "offer.street-find-canada": streetFind("offer.street-find-canada", "country.canada"),
  "offer.street-find-italy": streetFind("offer.street-find-italy", "country.italy"),

  // Abroad (group `abroad`)

  // ladders:sponsor-job-ties-status: the sponsor loses its licence and the job goes, which starts the clock.
  // Its chance a month is the world's `var.uk-care-sponsor-risk` (director.md), which the offer kind adds to the
  // entry's own chance of 0; the director's sponsor story raises it while in force.
  "offer.sponsor-licence-lost": {
    id: "offer.sponsor-licence-lost",
    group: "abroad",
    where: "abroad",
    // luck:no-kicking-while-down: a blow.
    bad: true,
    when: [
      { type: "status/is", statuses: ["status.uk-sponsored"] },
      { type: "job/is", activities: ["activity.job-uk-care"] },
    ],
    chanceBp: 0,
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

const assistanceOffers: Record<Id<"offer">, OfferEntry> = {
  // undertaking:social-assistance-offer: social assistance, the same for
  // every resident in Canada whose bank and cash together are under the line.
  // The amount is fixed by content (the start of var.canada-assistance), so no player
  // chooses what reaches a sponsor's bill. Group `abroad`, rolled every month it holds.
  "offer.canada-assistance": {
    id: "offer.canada-assistance",
    group: "abroad",
    where: "abroad",
    when: [
      { type: "place/is", where: "abroad", country: "country.canada" },
      { type: "status/is", statuses: ["status.canada-resident", "status.canada-citizen"] },
      { type: "not", of: { type: "money/min", currency: "CAD", amount: tuning.undertaking.assistanceUnder } },
    ],
    chanceBp: pct(100),
    cooldown: 1,
    maxTimes: null,
    expiresAfter: 1,
    terms: { amount: varTable["var.canada-assistance"]?.start ?? 0 },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "take",
        requires: [],
        pick: null,
        effects: [
          { type: "money/add", currency: "CAD", pocket: "bank", amount: { term: "amount" }, reason: "assistance" },
          // Counted for a sponsor's undertaking only after arriving on the spouse route (undertaking:social-assistance-offer).
          { type: "people/assistance-taken", route: "route.canada-spouse" },
          { type: "quality/add", quality: "quality.wellbeing", amount: 2 },
          { type: "quality/add", quality: "quality.standing", amount: -2 },
        ],
        fraudEffects: null,
      },
      { id: "leave", requires: [], pick: null, effects: [], fraudEffects: null },
    ],
    onExpire: "leave",
  },
};

export const abroadOfferTable: Record<Id<"offer">, OfferEntry> = { ...lifeAbroadOffers, ...assistanceOffers };
