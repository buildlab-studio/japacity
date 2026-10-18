// The price of sleeping under the bridge: streets:sleeping-under-the-bridge.
// Joined into the offer table in offer.data.ts and staged at the bridge.
//
// Each opens only in a month the character slept rough, and its `when` never
// reads money (luck:luck-never-reads-money; the content check holds it). The offer kind
// hands over two terms as an offer opens, which win over the placeholders
// here: `lost`, which line tells the theft (the cash goes as it opens, all or
// nothing), and `night`, the night's line for the character's sex (streets:sex-optional-with-neutral-path).
import type { Id, OfferEntry, Requirement } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";

const { street } = tuning;
const SLEPT_ROUGH: Requirement = { type: "activity/played", activity: "activity.sleep-rough" };

/** The one choice each has, to carry on, taken too when the offer lapses. */
function carryOn(id: Id<"offer">, chanceBp: number, effects: OfferEntry["choices"][number]["effects"], terms: OfferEntry["terms"]): OfferEntry {
  return {
    id,
    group: "life",
    bad: true,
    when: [SLEPT_ROUGH],
    chanceBp,
    cooldown: 0,
    maxTimes: null,
    expiresAfter: 1,
    terms,
    fraudBp: 0,
    signs: [],
    choices: [{ id: "carry-on", requires: [], pick: null, effects, fraudEffects: null }],
    onExpire: "carry-on",
  };
}

export const streetOfferTable: Record<Id<"offer">, OfferEntry> = {
  "offer.bridge-theft": carryOn("offer.bridge-theft", street.theftBp, [], { lost: 0 }),
  // The warning path of health:low-wellbeing-warns-first: one more run-down month on the counter.
  "offer.bridge-mosquitoes": carryOn("offer.bridge-mosquitoes", street.mosquitoBp, [{ type: "quality/add", quality: "quality.run-down-months", amount: 1 }], {}),
  "offer.bridge-night": carryOn("offer.bridge-night", street.harassBp, [{ type: "quality/add", quality: "quality.wellbeing", amount: -street.harassMood }], { night: 0 }),
};
