// London lived by hand: docs/rules/place.md R-PLACE-012 (the bus pass) and streets.md R-STREET-012 (design page 14
// section 6, decision 0042). Each is a priced now-act in pounds, paid as it is done; when each answers and the time it
// spends are in activity.when.data.ts and activity.days.data.ts. Joined into the activity table in activity.data.ts;
// place.data.ts stages each at its London place.
import type { ActivityEntry, Effect, Id, Reason, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { pounds } from "../units";

const UK: Id<"country"> = "country.uk";
const IN_UK: Requirement = { type: "place/is", where: "abroad", country: UK };

/** R-PLACE-012: the bus pass's figure, from the UK's rides in the tuning. */
function busPass(): number {
  const pass = tuning.city.ride.abroad[UK]?.pass;
  if (pass === undefined || pass === null) throw new Error("The UK's rides carry no bus pass.");
  return pass;
}

function lift(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** R-STREET-012: a priced now-act in the UK, its price in pounds under its money reason. */
function byHand(id: Id<"activity">, price: number, reason: Extract<Reason, "food" | "enjoyment">, effects: Effect[]): ActivityEntry {
  return {
    id,
    slot: "none",
    where: "abroad",
    country: UK,
    requires: [IN_UK],
    param: null,
    cost: [{ currency: "GBP", amount: pounds(price), reason }],
    pay: null,
    hireBp: null,
    effects,
    counts: [],
  };
}

export const londonActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // R-PLACE-012: a month of buses for one tap at the station's machine; the train is still per trip.
  "activity.bus-pass-uk": {
    id: "activity.bus-pass-uk",
    slot: "none",
    where: "abroad",
    country: UK,
    requires: [IN_UK],
    param: null,
    cost: [{ currency: "GBP", amount: busPass(), reason: "fare" }],
    pay: null,
    hireBp: null,
    effects: [],
    counts: [],
  },

  // streets.md R-STREET-012. At the big shop: the weekly shop fills the belly as a pot does.
  "activity.weekly-shop-uk": byHand("activity.weekly-shop-uk", 45, "food", [lift("quality.belly", 40)]),
  // In the room in the UK: a meal of your own, cooked in the shared kitchen, as a meal fills it at home.
  "activity.cook-own-uk": byHand("activity.cook-own-uk", 6, "food", [lift("quality.belly", 25)]),
  // On Rye Lane.
  "activity.chicken-shop": byHand("activity.chicken-shop", 7, "food", [lift("quality.belly", 20), lift("quality.wellbeing", 4)]),
  // A taste of home, dearer than the big shop.
  "activity.naija-shop-uk": byHand("activity.naija-shop-uk", 25, "food", [lift("quality.belly", 30), lift("quality.wellbeing", 8)]),
  "activity.pub-pint": byHand("activity.pub-pint", 6, "enjoyment", [lift("quality.wellbeing", 5), lift("quality.energy", -3)]),
  // Once a month each.
  "activity.barber-uk": byHand("activity.barber-uk", 15, "enjoyment", [lift("quality.wellbeing", 5), lift("quality.standing", 1), lift("quality.interview-prep", 2)]),
  "activity.buy-clothes-uk": byHand("activity.buy-clothes-uk", 40, "enjoyment", [lift("quality.standing", 1), lift("quality.wellbeing", 3)]),
};
