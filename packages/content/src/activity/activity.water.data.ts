// The fish racks at Makoko (docs/rules/activity.md R-ACTIVITY-017): the child of the water's work at hand, where
// they grew up. A main job the board lists to anyone whose room is on the lagoon, hired on a high chance; work at
// hand, not a way up (the stall reached on Makoko's savings is, R-ACTIVITY-016). It ends like any job at home on the
// flight (R-ACTIVITY-010). Joined into the activity table in activity.data.ts; place.data.ts stages it at Makoko.
import type { ActivityEntry, Id } from "@japacity/sim";

import { naira } from "../units";

export const RACKS: Id<"activity"> = "activity.job-fish-racks";
/** "A high hire chance": four months in five before the network's share (R-ACTIVITY-005). */
const RACKS_HIRE_BP = 8000;

export const waterActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // Edu-level 0: no schooling asked. "lives in Makoko" reads as the room on the lagoon being rented, so a
  // guest taken in after an eviction keeps the job (R-ACTIVITY-007) but the board stops listing it.
  // the rule also lists the racks for "anyone who asks around at Makoko"; no act asks around there yet.
  [RACKS]: {
    id: RACKS,
    slot: "main",
    where: "home",
    requires: [{ type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-makoko" }],
    param: null,
    cost: [],
    pay: { currency: "NGN", amount: naira(70000) },
    hireBp: RACKS_HIRE_BP,
    // Up before light, the smoke and the heat of the kiln.
    effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: -2 }],
    counts: [],
  },
};
