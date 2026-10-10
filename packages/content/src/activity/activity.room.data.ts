// The room's basics: docs/rules/obligation.md R-OBLIGATION-014 and world.md R-WORLD-029. Joined into
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
