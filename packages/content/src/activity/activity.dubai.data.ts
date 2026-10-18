// Dubai lived by hand: place:country-pass-covers-ways (the zone pass) and streets:dubai-life-by-hand (design page
// 15 section 5, decision 0017). Each is a priced now-act in dirhams, paid as it is done; when each answers and the time it
// spends are in activity.when.data.ts and activity.days.data.ts. Joined into the activity table in activity.data.ts;
// place.data.ts stages each at its Dubai place. The souq's shopping, in Naif, is in activity.abroad.data.ts.
import type { ActivityEntry, Effect, Id, Reason, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { aed } from "../units";

const UAE: Id<"country"> = "country.uae";
const IN_UAE: Requirement = { type: "place/is", where: "abroad", country: UAE };

/** place:country-pass-covers-ways: the zone pass's figure, from the UAE's rides in the tuning. */
function zonePass(): number {
  const pass = tuning.city.ride.abroad[UAE]?.pass;
  if (pass === undefined || pass === null) throw new Error("The UAE's rides carry no zone pass.");
  return pass;
}

function lift(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** A priced now-act in the UAE, its price in fils under its money reason. */
function byHand(id: Id<"activity">, fils: number, reason: Extract<Reason, "food" | "enjoyment" | "fare">, effects: Effect[]): ActivityEntry {
  return {
    id,
    slot: "none",
    where: "abroad",
    country: UAE,
    requires: [IN_UAE],
    param: null,
    cost: [{ currency: "AED", amount: fils, reason }],
    pay: null,
    hireBp: null,
    effects,
    counts: [],
  };
}

export const dubaiActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // place:country-pass-covers-ways: the month's Nol zone pass at Union station's machine, good on the bus and the metro.
  "activity.transit-pass-uae": byHand("activity.transit-pass-uae", zonePass(), "fare", []),

  // streets:dubai-life-by-hand. At the hypermarket: the weekly shop.
  "activity.weekly-shop-uae": byHand("activity.weekly-shop-uae", aed(150), "food", [lift("quality.belly", 40)]),
  // In the bed space at the camp: a meal of your own.
  "activity.cook-own-uae": byHand("activity.cook-own-uae", aed(8), "food", [lift("quality.belly", 25)]),
  // In Deira: the cafeteria, the African foods shop, and the barber once a month.
  "activity.cafeteria-uae": byHand("activity.cafeteria-uae", aed(12), "food", [lift("quality.belly", 25), lift("quality.wellbeing", 3)]),
  "activity.naija-shop-uae": byHand("activity.naija-shop-uae", aed(60), "food", [lift("quality.belly", 30), lift("quality.wellbeing", 8)]),
  "activity.barber-uae": byHand("activity.barber-uae", aed(25), "enjoyment", [lift("quality.wellbeing", 5), lift("quality.standing", 1)]),
  // In Naif: the tailor once a month, and the laundry.
  "activity.buy-clothes-uae": byHand("activity.buy-clothes-uae", aed(80), "enjoyment", [lift("quality.standing", 1), lift("quality.wellbeing", 3)]),
  "activity.laundry-uae": byHand("activity.laundry-uae", aed(20), "enjoyment", [lift("quality.wellbeing", 2)]),
};
