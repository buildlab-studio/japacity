// The room's basics: docs/rules/obligation.md R-OBLIGATION-014 and world.md R-WORLD-029. Joined into
// the activity table in activity.data.ts; place.data.ts stages each in the room.
import type { ActivityEntry, Id, Requirement } from "@japacity/sim";

import { naira } from "../units";
import { tuning } from "../tuning/tuning.data";

const { room } = tuning;

/**
 * Living where the drum is filled free from a tap: the room in a compound (home.md R-HOME-010), its upkeep open, or a
 * hostel room, its rent open.
 */
const COMPOUND: Requirement = {
  type: "any",
  of: [
    { type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-compound" },
    { type: "obligation/has", obligationType: "rent", obligation: "obligation.upkeep-hostel" },
  ],
};

/** A meal's lift: full, and a little better for it. */
const MEAL: ActivityEntry["effects"] = [
  { type: "obligation/relief", obligationType: "upkeep", bp: room.cookedBp },
  { type: "quality/add", quality: "quality.belly", amount: 25 },
  { type: "quality/add", quality: "quality.wellbeing", amount: 2 },
];
/** A pot's lift: full for longer, and the house or the compound eats too. */
const POT: ActivityEntry["effects"] = [
  { type: "quality/add", quality: "quality.belly", amount: 45 },
  { type: "quality/add", quality: "quality.wellbeing", amount: 6 },
  { type: "quality/add", quality: "quality.standing", amount: 2 },
];

// Each home's cooking corner carries its own acts by id, in its place file: the family house's
// pot is the house's, so eating from it costs nothing and the big pot is foodstuff bought for the house; a home of your
// own buys its meals and its pot at the price they cost. The simulation charges an act what its entry says, wherever
// it is done; which corner offers which act is the place file's.
export const roomActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // Food from Mama's pot at the family house, as often as you are hungry (R-ACTIVITY-019; decision 0035): the house's.
  "activity.cook-at-home": {
    id: "activity.cook-at-home",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: MEAL,
    counts: [],
  },
  // A big pot for the house: you buy the foodstuff, the house eats, and the family remembers who bought it.
  "activity.cook-jollof": {
    id: "activity.cook-jollof",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 4,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(7500), reason: "foodstuff" }],
    pay: null,
    hireBp: null,
    effects: POT,
    counts: [],
  },
  // A meal of your own, bought and cooked now, in your room or the room abroad (decision 0035: living by hand).
  "activity.cook-own": {
    id: "activity.cook-own",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "any",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(1500), reason: "food" }],
    pay: null,
    hireBp: null,
    effects: MEAL,
    counts: [],
  },
  // A pot of your own: a weekend at the burner, and the neighbours find a reason to greet you.
  "activity.cook-own-pot": {
    id: "activity.cook-own-pot",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 4,
    where: "home",
    requires: [],
    param: null,
    cost: [{ currency: "NGN", amount: naira(7500), reason: "food" }],
    pay: null,
    hireBp: null,
    effects: POT,
    counts: [],
  },
  // A nap on the mattress.
  "activity.nap": {
    id: "activity.nap",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.energy", amount: 20 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 1 },
    ],
    counts: [],
  },
  // A bucket bath.
  "activity.bucket-bath": {
    id: "activity.bucket-bath",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 3 },
      { type: "quality/add", quality: "quality.energy", amount: 3 },
    ],
    counts: [],
  },
  // Nollywood with Papa.
  "activity.watch-tv": {
    id: "activity.watch-tv",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 5 },
      { type: "quality/add", quality: "quality.energy", amount: -1 },
    ],
    counts: [],
  },
  // A few days in Mama's shop, paid in cash when the shutter comes down.
  "activity.help-shop": {
    id: "activity.help-shop",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 6,
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "activity/gig", min: naira(6000), max: naira(6000), perTech: 0 },
      { type: "quality/add", quality: "quality.standing", amount: 1 },
      { type: "quality/add", quality: "quality.energy", amount: -10 },
    ],
    counts: [],
  },
  // Water bought where it is sold (Makoko's seller, the family house's borehole down the street); the compound fills its drum from the yard instead.
  "activity.fetch-water": {
    id: "activity.fetch-water",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 2,
    where: "home",
    requires: [{ type: "not", of: COMPOUND }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "obligation/relief", obligationType: "upkeep", bp: room.waterBp },
      { type: "quality/add", quality: "quality.energy", amount: -8 },
    ],
    counts: [],
  },
  // The compound's drum, filled from the yard's tap or well: the water costs nothing there, so it takes nothing off (R-OBLIGATION-014).
  "activity.fill-drum": {
    id: "activity.fill-drum",
    slot: "none",
    when: "now",
    repeat: true,
    halfDays: 1,
    where: "home",
    requires: [COMPOUND],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [],
    counts: [],
  },
};
