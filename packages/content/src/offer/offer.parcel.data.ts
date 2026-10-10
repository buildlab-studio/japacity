// Things shipped home: docs/rules/streets.md R-STREET-010, opened by offer.parcel.ts in the simulation.
// Joined into the offer table in offer.data.ts; its words are in offer.parcel.text.ts. The aunty is the
// one of `offer.relative-sends`, on the same condition. The things live here, as the parcel's choices,
// since each is a set of effects the game already has.
import type { Effect, Id, OfferChoice, OfferEntry, Requirement } from "@japacity/sim";

import { streetActivityTable } from "../activity/activity.street.data";
import { tuning } from "../tuning/tuning.data";
import { ANY_ROUTE_KNOWN } from "./offer.luck.data";

const { parcel, room } = tuning;

export const PARCEL: Id<"offer"> = "offer.parcel-shipped";

/** Who ships a parcel: the prefix of the choices that are theirs. */
export const SENDERS = ["aunty", "sibling"] as const;

/** What a parcel may hold, in the order the draw counts them. */
export const THINGS = ["phone", "laptop", "clothes", "food"] as const;

/** A sibling whose facts put them abroad, at any stage of the bond but ended. */
const SIBLING_ABROAD: Requirement = { type: "people/bond", role: "sibling", stages: ["connected", "courting", "partner", "married"], where: "abroad" };

/** The phone is the street's phone: what `activity.buy-phone` gives, read from that entry so the two never drift. */
const PHONE: Effect[] = streetActivityTable["activity.buy-phone"]?.effects ?? [];

const GIVES: Record<(typeof THINGS)[number], Effect[]> = {
  phone: PHONE,
  laptop: [{ type: "quality/add", quality: "quality.wellbeing", amount: parcel.laptopMood }],
  clothes: [{ type: "quality/add", quality: "quality.interview-prep", amount: parcel.clothesPrep }],
  food: [{ type: "obligation/relief", obligationType: "upkeep", bp: room.cookedBp }],
};

/** The clerk's charge, cash first then the bank (decision 0012), the same for every thing. */
const HANDLING: Effect = { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "handling" }, reason: "upkeep" };

function choice(sender: (typeof SENDERS)[number], thing: (typeof THINGS)[number]): OfferChoice {
  return { id: `${sender}-${thing}`, requires: [], pick: null, effects: [HANDLING, ...GIVES[thing]], fraudEffects: null };
}

export const parcelOfferTable: Record<Id<"offer">, OfferEntry> = {
  [PARCEL]: {
    id: PARCEL,
    group: "life",
    // Collected in Lagos: a flight closes it unanswered (R-OFFER-005).
    where: "home",
    when: [{ type: "any", of: [SIBLING_ABROAD, ANY_ROUTE_KNOWN] }],
    // Never rolled: the offer kind opens it on a birthday month.
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    // It waits at the office for three months.
    expiresAfter: 3,
    // `from` and `holds` are handed over as it opens, and `handling` again from the live tuning.
    terms: { handling: parcel.handling, from: 0, holds: 0 },
    fraudBp: 0,
    signs: [],
    choices: SENDERS.flatMap((sender) => THINGS.map((thing) => choice(sender, thing))),
    // Left at the office, it goes back: nothing is paid and nothing is given.
    onExpire: null,
  },
};
