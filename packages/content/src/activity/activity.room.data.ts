// The room's basics: docs/rules/obligation.md R-OBLIGATION-014 and world.md R-WORLD-029. Joined into
// the activity table in activity.data.ts; place.data.ts stages each in the room.
import type { ActivityEntry, Id, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const { room } = tuning;

/** Living in the room in a compound (home.md R-HOME-010): its upkeep is open. */
const COMPOUND: Requirement = { type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-compound" };

export const roomActivityTable: Record<Id<"activity">, ActivityEntry> = {
  "activity.cook-at-home": {
    id: "activity.cook-at-home",
    slot: "none",
    where: "any",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [
      { type: "obligation/relief", obligationType: "upkeep", bp: room.cookedBp },
      // A weekend at the pot.
      { type: "quality/add", quality: "quality.wellbeing", amount: -room.cookWellbeing },
    ],
    counts: [],
  },
  // Water bought where it is sold (Makoko's seller, the family house's borehole down the street); the compound fills its drum from the yard instead.
  "activity.fetch-water": {
    id: "activity.fetch-water",
    slot: "none",
    where: "home",
    requires: [{ type: "not", of: COMPOUND }],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "obligation/relief", obligationType: "upkeep", bp: room.waterBp }],
    counts: [],
  },
  // The compound's drum, filled from the yard's tap or well: the water costs nothing there, so it takes nothing off (R-OBLIGATION-014).
  "activity.fill-drum": {
    id: "activity.fill-drum",
    slot: "none",
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
