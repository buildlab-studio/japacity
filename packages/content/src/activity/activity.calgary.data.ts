// Calgary lived by hand: docs/rules/place.md R-PLACE-012 (the transit pass) and streets.md R-STREET-013 (design
// page 15 section 5, decision 0043). Each is a priced now-act in Canadian dollars, paid as it is done; when each answers
// and the time it spends are in activity.when.data.ts and activity.days.data.ts. Joined into the activity table in
// activity.data.ts; place.data.ts stages each at its Calgary place.
import type { ActivityEntry, Effect, Id, Reason, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { cad } from "../units";

const CANADA: Id<"country"> = "country.canada";
const IN_CANADA: Requirement = { type: "place/is", where: "abroad", country: CANADA };

/** R-PLACE-012: the transit pass's figure, from Canada's rides in the tuning. */
function transitPass(): number {
  const pass = tuning.city.ride.abroad[CANADA]?.pass;
  if (pass === undefined || pass === null) throw new Error("Canada's rides carry no transit pass.");
  return pass;
}

function lift(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** A priced now-act in Canada, its price in cents under its money reason. */
function byHand(id: Id<"activity">, cents: number, reason: Extract<Reason, "food" | "enjoyment" | "fare">, effects: Effect[]): ActivityEntry {
  return {
    id,
    slot: "none",
    where: "abroad",
    country: CANADA,
    requires: [IN_CANADA],
    param: null,
    cost: [{ currency: "CAD", amount: cents, reason }],
    pay: null,
    hireBp: null,
    effects,
    counts: [],
  };
}

export const calgaryActivityTable: Record<Id<"activity">, ActivityEntry> = {
  // R-PLACE-012: one ticket for the month at the CTrain station's machine, good on the bus and the train.
  "activity.transit-pass-ca": byHand("activity.transit-pass-ca", transitPass(), "fare", []),

  // streets.md R-STREET-013. At the superstore: the weekly shop, and the coat the winter asks for.
  "activity.weekly-shop-ca": byHand("activity.weekly-shop-ca", cad(90), "food", [lift("quality.belly", 40)]),
  "activity.buy-clothes-ca": byHand("activity.buy-clothes-ca", cad(120), "enjoyment", [lift("quality.standing", 1), lift("quality.wellbeing", 4)]),
  // In the basement room: a meal of your own.
  "activity.cook-own-ca": byHand("activity.cook-own-ca", cad(8), "food", [lift("quality.belly", 25)]),
  // At the strip mall: a coffee for no time, the African store, and the barber once a month.
  "activity.coffee-ca": byHand("activity.coffee-ca", cad(3), "enjoyment", [lift("quality.wellbeing", 2)]),
  "activity.naija-shop-ca": byHand("activity.naija-shop-ca", cad(40), "food", [lift("quality.belly", 30), lift("quality.wellbeing", 8)]),
  "activity.barber-ca": byHand("activity.barber-ca", cad(30), "enjoyment", [lift("quality.wellbeing", 5), lift("quality.standing", 1), lift("quality.interview-prep", 2)]),
};
