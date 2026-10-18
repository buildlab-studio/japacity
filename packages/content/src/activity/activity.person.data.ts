// From docs/rules/person.md "Entries: activities and offers" (person:time-together-is-an-act).
// Joined into the activity table in activity.data.ts.
//
// "In the same place" and "elsewhere" are written as requirements on
// where the character is and where the bond's other side is, joined with
// `not` and `any`, so a slot is offered only when a bond fits it.
// The page prices seeing someone by country (₦20,000, £30, C$40 or
// AED 100), but an activity's cost is one list paid in full, so only the
// naira price is entered.
import type { ActivityEntry, BondStage, Id, Requirement } from "@japacity/sim";

import { naira } from "../units";

const COURTED: BondStage[] = ["courting", "partner", "married"];
const COUNTRIES: Id<"country">[] = ["country.uk", "country.canada", "country.uae", "country.italy"];

/** Both hold: neither fails. */
function both(first: Requirement, second: Requirement): Requirement {
  return { type: "not", of: { type: "any", of: [{ type: "not", of: first }, { type: "not", of: second }] } };
}

function bondAt(where: { where?: "home" | "abroad"; country?: Id<"country"> }): Requirement {
  return { type: "people/bond", role: "partner", stages: COURTED, ...where };
}

function abroadIn(country: Id<"country">): Requirement {
  return { type: "place/is", where: "abroad", country };
}

const AT_HOME: Requirement = { type: "place/is", where: "home" };
const ABROAD: Requirement = { type: "place/is", where: "abroad" };

/** A bond at courting or later whose other side is where the character is. */
const SAME_PLACE: Requirement = {
  type: "any",
  of: [both(AT_HOME, bondAt({ where: "home" })), ...COUNTRIES.map((country) => both(abroadIn(country), bondAt({ country })))],
};

/** A bond at courting or later whose other side is somewhere else. */
const ELSEWHERE: Requirement = {
  type: "any",
  of: [
    both(AT_HOME, bondAt({ where: "abroad" })),
    both(ABROAD, bondAt({ where: "home" })),
    ...COUNTRIES.map((country) => both(abroadIn(country), { type: "any", of: COUNTRIES.filter((other) => other !== country).map((other) => bondAt({ country: other })) })),
  ],
};

export const peopleActivityTable: Record<Id<"activity">, ActivityEntry> = {
  "activity.see-someone": {
    id: "activity.see-someone",
    slot: "free",
    where: "any",
    country: null,
    requires: [SAME_PLACE],
    param: null,
    cost: [{ currency: "NGN", amount: naira(20000), reason: "social" }],
    pay: null,
    hireBp: null,
    effects: [
      { type: "quality/add", quality: "quality.wellbeing", amount: 3 },
      { type: "people/moment", kind: "met" },
    ],
    counts: [],
  },
  "activity.call-someone": {
    id: "activity.call-someone",
    slot: "free",
    where: "any",
    country: null,
    requires: [ELSEWHERE],
    param: null,
    cost: [],
    pay: null,
    hireBp: null,
    effects: [{ type: "people/moment", kind: "call" }],
    counts: [],
  },
};
