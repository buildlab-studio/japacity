// The life of the streets abroad in content (docs/rules/streets.md R-STREET-005 to 007, world.md
// R-WORLD-026): the shopping and the find at Peckham and Deira, their numbers from `tuning.street`,
// where they are staged, and the street talk in Nigerian voices.
import type { Id, PlaceEntry } from "@japacity/sim";
import { ActivityEntrySchema, OfferEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const street = content.tuning.street;
const places: PlaceEntry[] = Object.values(content.place);
const DASHES = /[\u2010\u2012\u2013\u2014\u2015\u2212]/;
/** A Nigerian voice: a word of Lagos's own, as the Lagos places' talk has them. */
const VOICE = /\b(na|abeg|jare|sha|dey|don|e|am|abi|o|ugu|jumat|my guy|my brother)\b/i;

/** The places that stage an id. */
function stagedAt(id: string): string[] {
  return places.filter((place) => (place.stages as readonly string[]).includes(id)).map((place) => place.id);
}

/** The talk overheard in a place, in order. */
function overheard(place: string): string[] {
  const lines: string[] = [];
  for (let n = 1; text[`${place}.overheard.${String(n)}`] !== undefined; n += 1) lines.push(text[`${place}.overheard.${String(n)}`] ?? "");
  return lines;
}

const SHOPPING = [
  // the UK's stalls stand on Rye Lane and are paid as enjoyment.
  { id: "activity.street-shopping-uk" as Id<"activity">, country: "country.uk", currency: "GBP", amount: street.shoppingGbp, reason: "enjoyment", place: "place.peckham" },
  { id: "activity.street-shopping-uae" as Id<"activity">, country: "country.uae", currency: "AED", amount: street.shoppingAed, reason: "social", place: "place.deira" },
] as const;

const FINDS = [
  { id: "offer.street-find-uk" as Id<"offer">, country: "country.uk", place: "place.peckham" },
  { id: "offer.street-find-uae" as Id<"offer">, country: "country.uae", place: "place.deira" },
] as const;

describe("shopping on the street abroad", () => {
  test("[R-STREET-005] given the two street shoppings, when their entries are read, then each is a free slot abroad in its own country, costs the street's price in that currency (London's as enjoyment) and lifts the mood by the street's figure", () => {
    expect(street).toMatchObject({ shoppingGbp: 2000, shoppingAed: 8000, shoppingMood: 5 });
    for (const want of SHOPPING) {
      const entry = content.activity[want.id];
      if (entry === undefined) throw new Error(`No ${want.id}`);
      expect(ActivityEntrySchema.safeParse(entry).error?.issues ?? []).toEqual([]);
      expect(entry).toMatchObject({ slot: "free", where: "abroad", country: want.country, param: null, pay: null, hireBp: null });
      expect(entry.requires).toEqual([{ type: "place/is", where: "abroad", country: want.country }]);
      expect(entry.cost).toEqual([{ currency: want.currency, amount: want.amount, reason: want.reason }]);
      expect(entry.effects).toEqual([{ type: "quality/add", quality: "quality.wellbeing", amount: street.shoppingMood }]);
    }
  });

  test("[R-STREET-005] [R-CITY-010] given the two street shoppings, when the places are read, then each is staged once, at Peckham and at Deira, and each has a name and a blurb with no dash", () => {
    for (const want of SHOPPING) {
      expect(stagedAt(want.id)).toEqual([want.place]);
      const keys = [`${want.id}.name`, `${want.id}.blurb`];
      expect(keys.filter((key) => (text[key] ?? "").trim() === "" || DASHES.test(text[key] ?? ""))).toEqual([]);
    }
  });
});

describe("something interesting on the street", () => {
  test("[R-STREET-006] given the two finds, when their entries are read, then each is a life offer abroad in its own country at the street's chance, cooldown 2, no blow and no fraud, with one choice to look that lifts the mood by the street's figure", () => {
    expect(street).toMatchObject({ findBp: 1500, findMood: 4 });
    for (const want of FINDS) {
      const entry = content.offer[want.id];
      if (entry === undefined) throw new Error(`No ${want.id}`);
      expect(OfferEntrySchema.safeParse(entry).error?.issues ?? []).toEqual([]);
      expect(entry).toMatchObject({ group: "life", where: "abroad", bad: false, chanceBp: street.findBp, cooldown: 2, fraudBp: 0, signs: [] });
      expect(entry.luck).toBeUndefined();
      expect(entry.when).toEqual([{ type: "place/is", where: "abroad", country: want.country }]);
      expect(entry.choices).toEqual([
        { id: "look", requires: [], pick: null, effects: [{ type: "quality/add", quality: "quality.wellbeing", amount: street.findMood }], fraudEffects: null },
        { id: "walk-on", requires: [], pick: null, effects: [], fraudEffects: null },
      ]);
    }
  });

  test("[R-STREET-006] [R-CITY-010] given the two finds, when the places and the words are read, then each is staged once, at Peckham and at Deira, and has its name, title, body and choice with no dash", () => {
    for (const want of FINDS) {
      expect(stagedAt(want.id)).toEqual([want.place]);
      const keys = [`${want.id}.name`, `${want.id}.title`, `${want.id}.body`, `${want.id}.choice.look`];
      expect(keys.filter((key) => (text[key] ?? "").trim() === "" || DASHES.test(text[key] ?? ""))).toEqual([]);
    }
  });
});

describe("the street talk abroad", () => {
  test("[R-STREET-007] [R-WORLD-026] given Peckham's talk overheard, when it is read, then at least six lines speak in a Nigerian voice, none with a dash", () => {
    const lines = overheard("place.peckham");
    expect(lines.filter((line) => line.trim() === "")).toEqual([]);
    expect(lines.filter((line) => DASHES.test(line))).toEqual([]);
    expect(lines.filter((line) => VOICE.test(line)).length).toBeGreaterThanOrEqual(6);
  });

  test("[R-STREET-007] [R-WORLD-026] given Deira's talk overheard, when it is read, then at least four lines speak in a Nigerian voice, none with a dash", () => {
    const lines = overheard("place.deira");
    expect(lines.filter((line) => line.trim() === "")).toEqual([]);
    expect(lines.filter((line) => DASHES.test(line))).toEqual([]);
    expect(lines.filter((line) => VOICE.test(line)).length).toBeGreaterThanOrEqual(4);
  });
});
