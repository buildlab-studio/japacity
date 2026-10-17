// Illness and the forced months: docs/rules/health.md R-HEALTH-002, 003, 005 and 006.
// Joined into the offer table in offer.data.ts.
//
// The illness and its worse turn are never rolled here (chance 0): the offer kind's health
// roll opens them on the stream `health` with the prices from `tuning.health`, which win over
// the terms below. The burial and the court date are rolled like any other offer.
//
// Each choice that takes a slot carries its own `turn/lock`. The burial's `lockNext`
// names the same lock, but only `go` takes it: `send-money` and `absent` lock nothing, so a lock
// on every choice would be wrong. The same choices fill `quality.forced-wait`, which is how the
// cap of one forced month in twelve is counted (R-HEALTH-005).
import type { Effect, Id, OfferEntry, Requirement } from "@japacity/sim";

import { qualityTable } from "../quality/quality.data";
import { tuning } from "../tuning/tuning.data";
import { naira } from "../units";

const WELLBEING: Id<"quality"> = "quality.wellbeing";
const STANDING: Id<"quality"> = "quality.standing";
const COURSE: Id<"quality"> = "quality.illness-course";
const FORCED_WAIT: Id<"quality"> = "quality.forced-wait";

/** Fills the wait before another forced month to its top: twelve months. */
const FORCED: Effect = { type: "quality/add", quality: FORCED_WAIT, amount: qualityTable[FORCED_WAIT]?.max ?? 0 };

/** No forced month in the last twelve (R-HEALTH-005). */
const NO_FORCED_MONTH: Requirement = { type: "quality/max", quality: FORCED_WAIT, value: 0 };

function lock(slots: number, months: number, why: string): Extract<Effect, { type: "turn/lock" }> {
  return { type: "turn/lock", slots, months, why };
}

const BED_REST = lock(1, 1, "illness");
const BURIAL_LOCK = lock(1, 1, "burial");
const COURT_LOCK = lock(1, 1, "court");

export const healthOfferTable: Record<Id<"offer">, OfferEntry> = {
  // R-HEALTH-002. It lapses after one month into `ignore`.
  "offer.illness": {
    id: "offer.illness",
    group: "life",
    bad: true,
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    terms: { hospital: tuning.health.hospital, chemist: tuning.health.chemist },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "hospital",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "transfer", amount: { term: "hospital" }, reason: "mishap" },
          BED_REST,
          { type: "quality/add", quality: WELLBEING, amount: 20 },
          FORCED,
        ],
        fraudEffects: null,
      },
      {
        id: "chemist",
        requires: [],
        pick: null,
        // Course 1: the relapse is drawn at the chemist's chance.
        effects: [
          { type: "money/take", currency: "NGN", pocket: "transfer", amount: { term: "chemist" }, reason: "mishap" },
          { type: "quality/add", quality: WELLBEING, amount: 8 },
          { type: "quality/add", quality: COURSE, amount: 1 },
        ],
        fraudEffects: null,
      },
      {
        id: "ignore",
        requires: [],
        pick: null,
        // Course 2: the relapse is drawn at ignoring's chance.
        effects: [BED_REST, { type: "quality/add", quality: WELLBEING, amount: -15 }, { type: "quality/add", quality: COURSE, amount: 2 }, FORCED],
        fraudEffects: null,
      },
    ],
    onExpire: "ignore",
  },

  // R-HEALTH-003. Opened only by the relapse. `wellbeing` is where wellbeing returns once it is over.
  // Unanswered, it lapses into `cannot`; when the hospital could have been paid, the health
  // roll still applies `cannot` at the next come-up, since the family nursed you all the same.
  "offer.illness-worse": {
    id: "offer.illness-worse",
    group: "life",
    bad: true,
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    terms: { hospital: tuning.health.hospitalWorse, wellbeing: 40 },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "hospital",
        requires: [],
        pick: null,
        // Course 4: answered.
        effects: [
          { type: "money/take", currency: "NGN", pocket: "transfer", amount: { term: "hospital" }, reason: "mishap" },
          lock(2, 2, "illness"),
          FORCED,
          { type: "quality/add", quality: COURSE, amount: 1 },
        ],
        fraudEffects: null,
      },
      {
        id: "cannot",
        requires: [{ type: "not", of: { type: "money/can-pay", currency: "NGN", amount: { term: "hospital" } } }],
        pick: null,
        effects: [lock(2, 3, "illness"), { type: "quality/add", quality: STANDING, amount: -5 }, FORCED, { type: "quality/add", quality: COURSE, amount: 1 }],
        fraudEffects: null,
      },
    ],
    onExpire: "cannot",
  },

  // R-HEALTH-006: family, at home, standing 20 or more. It says so a month ahead: `go` takes a slot next month.
  "offer.village-burial": {
    id: "offer.village-burial",
    group: "family",
    where: "home",
    lockNext: { slots: BURIAL_LOCK.slots, months: BURIAL_LOCK.months, why: BURIAL_LOCK.why },
    when: [{ type: "place/is", where: "home" }, { type: "quality/min", quality: STANDING, value: 20 }, NO_FORCED_MONTH],
    // 1.5%
    chanceBp: 150,
    // The page gives no cooldown; the forced-month cap already keeps it to one a year.
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
        effects: [{ type: "money/take", currency: "NGN", pocket: "transfer", amount: naira(60000), reason: "family" }, BURIAL_LOCK, FORCED],
        fraudEffects: null,
      },
      {
        id: "send-money",
        requires: [],
        pick: null,
        effects: [
          { type: "money/take", currency: "NGN", pocket: "transfer", amount: naira(100000), reason: "family" },
          { type: "quality/add", quality: STANDING, amount: -3 },
        ],
        fraudEffects: null,
      },
      {
        id: "absent",
        requires: [],
        pick: null,
        effects: [{ type: "quality/add", quality: STANDING, amount: -10 }],
        fraudEffects: null,
      },
    ],
    onExpire: "absent",
  },

  // R-HEALTH-006: abroad, a court date over what is still owed. A day lost: one slot next month.
  // "A car shortfall or a defaulted loan abroad" is a loan held abroad. The car shortfall is a
  // loan; `obligation/has` does not count a loan already in default, so a defaulted loan alone does
  // not bring it. No requirement reads a judgment on the file (an open question in health.md).
  "offer.court-date": {
    id: "offer.court-date",
    group: "abroad",
    where: "abroad",
    lockNext: { slots: COURT_LOCK.slots, months: COURT_LOCK.months, why: COURT_LOCK.why },
    when: [{ type: "place/is", where: "abroad" }, { type: "obligation/has", obligationType: "loan" }, NO_FORCED_MONTH],
    // 5%
    chanceBp: 500,
    // The page gives no cooldown; the forced-month cap already keeps it to one a year.
    cooldown: 12,
    maxTimes: null,
    expiresAfter: 1,
    terms: {},
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "attend",
        requires: [],
        pick: null,
        effects: [COURT_LOCK, FORCED],
        fraudEffects: null,
      },
    ],
    onExpire: "attend",
  },
};
