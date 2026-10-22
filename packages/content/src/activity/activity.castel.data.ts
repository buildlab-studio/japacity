// Castel Volturno lived by hand: streets:castel-volturno-by-hand (design page 11 section 5). Each is a priced now-act
// in euros, paid as it is done, and the church's community is free; when each answers and the time it spends are in
// activity.when.data.ts and activity.days.data.ts. Joined into the activity table in activity.data.ts; place.data.ts
// stages each at its Castel Volturno place. There is no pass here (place:country-pass-covers-ways): the bus is paid each time.
import type { ActivityEntry, Effect, Id, Reason, Requirement } from "@japacity/sim";

import { euros } from "../units";

const ITALY: Id<"country"> = "country.italy";
const IN_ITALY: Requirement = { type: "place/is", where: "abroad", country: ITALY };

function lift(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** A priced now-act in Italy, its price in cents under its money reason. */
function byHand(id: Id<"activity">, cents: number, reason: Extract<Reason, "food" | "enjoyment">, effects: Effect[]): ActivityEntry {
  return {
    id,
    slot: "none",
    where: "abroad",
    country: ITALY,
    requires: [IN_ITALY],
    param: null,
    cost: [{ currency: "EUR", amount: cents, reason }],
    pay: null,
    hireBp: null,
    effects,
    counts: [],
  };
}

export const castelActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // streets:castel-volturno-by-hand. At the discount supermarket: the weekly shop.
  "activity.weekly-shop-italy": byHand("activity.weekly-shop-italy", euros(35), "food", [lift("quality.belly", 40)]),
  // In the room in a shared flat: a meal of your own.
  "activity.cook-own-italy": byHand("activity.cook-own-italy", euros(4), "food", [lift("quality.belly", 25)]),
  // At the roundabout: a coffee at the bar for no time, and the African shop.
  "activity.coffee-italy": byHand("activity.coffee-italy", 120, "enjoyment", [lift("quality.wellbeing", 2)]),
  "activity.naija-shop-italy": byHand("activity.naija-shop-italy", euros(20), "food", [lift("quality.belly", 30), lift("quality.wellbeing", 8)]),
  // On the Domitiana: the barber and the stall once a month, and the Nigerian shop's evening.
  "activity.barber-italy": byHand("activity.barber-italy", euros(10), "enjoyment", [lift("quality.wellbeing", 5), lift("quality.standing", 1)]),
  "activity.buy-clothes-italy": byHand("activity.buy-clothes-italy", euros(25), "enjoyment", [lift("quality.standing", 1), lift("quality.wellbeing", 3)]),
  "activity.street-shopping-italy": byHand("activity.street-shopping-italy", euros(15), "enjoyment", [lift("quality.wellbeing", 5)]),
  // The church: the community's place, as activity.community-uk is in London, and free.
  "activity.community-italy": {
    id: "activity.community-italy",
    slot: "free",
    where: "abroad",
    country: ITALY,
    requires: [IN_ITALY],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [lift("quality.network", 4), lift("quality.wellbeing", 4)],
    counts: [],
  },
};
