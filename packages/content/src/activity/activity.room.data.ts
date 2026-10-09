// The room's basics: docs/rules/obligation.md R-OBLIGATION-014 and world.md R-WORLD-029. Two
// choices made once a month that ride with it and fill no slot: cooking for the week, at home and
// abroad, and fetching water, at home only (abroad the room has a tap). Each takes its share off the
// next charge of the upkeep where the character lives. The figures are `tuning.room`. Joined into
// the activity table in activity.data.ts; place.data.ts stages each in the room.
import type { ActivityEntry, Id } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const { room } = tuning;

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
  "activity.fetch-water": {
    id: "activity.fetch-water",
    slot: "none",
    where: "home",
    requires: [],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "obligation/relief", obligationType: "upkeep", bp: room.waterBp }],
    counts: [],
  },
};
