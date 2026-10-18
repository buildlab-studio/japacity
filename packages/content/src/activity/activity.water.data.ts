// The fish racks at Makoko (activity:fish-racks-at-makoko): the child of the water's work at hand, where
// they grew up. A main job the board lists to anyone whose room is on the lagoon, hired on a high chance; work at
// hand, not a way up (the stall reached on Makoko's savings is, activity:trader-opens-own-shop). It ends like any job at home on the
// flight (activity:side-job-holds-a-slot). Joined into the activity table in activity.data.ts; place.data.ts stages it at Makoko.
import type { ActivityEntry, Id } from "@japacity/sim";

import { naira } from "../units";

export const RACKS: Id<"activity"> = "activity.job-fish-racks";
/**
 * Work at hand: the bar every hunt stops at (activity:job-hunt-lands-offer, `tuning.quality.hireMaxBp`), so "not this time" is rare.
 * A certain hire would need the bar lifted for the racks alone.
 */
const RACKS_HIRE_BP = 9500;

export const waterActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // Edu-level 0: no schooling asked. "Lives in Makoko" is the room on the lagoon being rented, so a
  // guest taken in after an eviction keeps the job (activity:requirements-judged-at-hunt) but the board stops listing it.
  // The rule also lists the racks for "anyone who asks around at Makoko"; no act asks around there.
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
