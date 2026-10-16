// London lived by hand: docs/rules/place.md R-PLACE-012 (the bus pass) and streets.md R-STREET-012 (design page 14
// section 6, decision 0042). Each is a priced now-act in pounds, paid as it is done; when each answers and the time it
// spends are in activity.when.data.ts and activity.days.data.ts. Joined into the activity table in activity.data.ts;
// place.data.ts stages each at its London place.
import type { ActivityEntry, Id, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const UK: Id<"country"> = "country.uk";
const IN_UK: Requirement = { type: "place/is", where: "abroad", country: UK };

/** R-PLACE-012: the bus pass's figure, from the UK's rides in the tuning. */
function busPass(): number {
  const pass = tuning.city.ride.abroad[UK]?.pass;
  if (pass === undefined || pass === null) throw new Error("The UK's rides carry no bus pass.");
  return pass;
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
};
