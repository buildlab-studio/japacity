// docs/rules/home.md: the two asks of living in Makoko. Neither is rolled: the eviction opens the
// first (R-HOME-003) and the end of a stay the second (R-HOME-004).
import type { Id, OfferEntry } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const FAMILY_HOUSE = { type: "home/move", place: "place.family-house" } as const;

export const homeOfferTable: Record<Id<"offer">, OfferEntry> = {
  "offer.taken-in": {
    id: "offer.taken-in",
    group: "life",
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    // Answered by the next month's end, or it takes the family house.
    expiresAfter: 1,
    terms: { months: tuning.home.guestMonths },
    fraudBp: 0,
    signs: [],
    choices: [
      { id: "friend", requires: [{ type: "home/host", host: "friend" }], pick: null, effects: [{ type: "home/guest", host: "friend" }], fraudEffects: null },
      { id: "someone", requires: [{ type: "home/host", host: "someone" }], pick: null, effects: [{ type: "home/guest", host: "someone" }], fraudEffects: null },
      { id: "family", requires: [], pick: null, effects: [FAMILY_HOUSE], fraudEffects: null },
    ],
    onExpire: "family",
  },
  "offer.where-next": {
    id: "offer.where-next",
    group: "life",
    when: [],
    chanceBp: 0,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    // The rent is handed over again when the offer opens, so an overlay's figure is the one asked.
    terms: { rent: tuning.home.makokoUpkeep, months: tuning.home.guestMonths },
    fraudBp: 0,
    signs: [],
    choices: [
      {
        id: "makoko",
        requires: [],
        pick: null,
        // The first month's rent, cash first then bank, paid by the answer so the button shows it.
        effects: [
          { type: "money/take", currency: "NGN", pocket: "any", amount: { term: "rent" }, reason: "upkeep" },
          { type: "home/move", place: "place.makoko" },
        ],
        fraudEffects: null,
      },
      { id: "family", requires: [], pick: null, effects: [FAMILY_HOUSE], fraudEffects: null },
    ],
    onExpire: "family",
  },
};
