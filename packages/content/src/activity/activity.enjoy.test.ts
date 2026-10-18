// Enjoyment and spending on the street: streets:lagos-street-spending (decision 0012). Each act is a priced
// now-act paid under the money reason `enjoyment`, with its time, how often it runs and its small lift, staged at
// one street.
import type { Effect, Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { naira } from "../units";

type Often = "repeat" | "once" | "purchase";

interface Rule {
  id: Id<"activity">;
  place: Id<"place">;
  price: number;
  halfDays: number;
  often: Often;
  effects: [string, number][];
}

/** The rule's list, in its order, with its numbers. */
const RULE: readonly Rule[] = [
  { id: "activity.buy-suya", place: "place.ojuelegba", price: 2500, halfDays: 1, often: "repeat", effects: [["quality.belly", 20], ["quality.wellbeing", 5]] },
  { id: "activity.mallam-tea", place: "place.ojuelegba", price: 500, halfDays: 1, often: "repeat", effects: [["quality.wellbeing", 4], ["quality.energy", 5], ["quality.standing", 1]] },
  { id: "activity.pure-water", place: "place.ojuelegba", price: 100, halfDays: 0, often: "purchase", effects: [["quality.energy", 4], ["quality.wellbeing", 2]] },
  { id: "activity.barber", place: "place.bode-thomas", price: 3000, halfDays: 1, often: "once", effects: [["quality.wellbeing", 5], ["quality.standing", 1], ["quality.interview-prep", 2]] },
  { id: "activity.viewing-centre", place: "place.bode-thomas", price: 1000, halfDays: 2, often: "repeat", effects: [["quality.wellbeing", 8], ["quality.energy", -3], ["quality.network", 1]] },
  { id: "activity.beer-joint", place: "place.bode-thomas", price: 2500, halfDays: 1, often: "repeat", effects: [["quality.wellbeing", 6], ["quality.belly", 5], ["quality.energy", -4]] },
  { id: "activity.night-out", place: "place.bode-thomas", price: 20000, halfDays: 2, often: "repeat", effects: [["quality.wellbeing", 12], ["quality.energy", -20], ["quality.network", 2]] },
  { id: "activity.buy-clothes", place: "place.tejuosho-market", price: 15000, halfDays: 2, often: "once", effects: [["quality.standing", 2], ["quality.wellbeing", 4]] },
];

const DASH = /[\u2013\u2014]/u;

function short(id: Id<"activity">): string {
  return id.slice("activity.".length);
}

describe("enjoyment and spending on the street", () => {
  test("[streets:lagos-street-spending] given each act the rule lists, when its entry is read from content, then it is a now-act at home with the rule's price in naira under enjoyment, its time, how often it runs and its lift", () => {
    for (const rule of RULE) {
      const entry = content.activity[rule.id];
      const effects: Effect[] = rule.effects.map(([quality, amount]) => ({ type: "quality/add", quality: quality as Id<"quality">, amount }));
      expect({ id: rule.id, entry }).toEqual({
        id: rule.id,
        entry: {
          id: rule.id,
          slot: "none",
          when: "now",
          ...(rule.often === "repeat" ? { repeat: true } : {}),
          ...(rule.often === "purchase" ? { purchase: true } : {}),
          halfDays: rule.halfDays,
          where: "home",
          requires: [],
          param: null,
          cost: [{ currency: "NGN", amount: naira(rule.price), reason: "enjoyment" }],
          pay: null,
          hireBp: null,
          effects,
          counts: [],
        },
      });
    }
  });

  test("[streets:lagos-street-spending] given each act, when the places are read, then its own street stages it and no other place does", () => {
    for (const rule of RULE) {
      const staging = Object.values(content.place).filter((place) => (place.stages as readonly string[]).includes(rule.id)).map((place) => place.id);
      expect({ id: rule.id, staging }).toEqual({ id: rule.id, staging: [rule.place] });
    }
  });

  test("[streets:lagos-street-spending] given each act, when its words are read, then its name, blurb and the place's answer resolve, with no en or em dash", () => {
    for (const rule of RULE) {
      for (const key of [`${rule.id}.name`, `${rule.id}.blurb`, `line.activity.${short(rule.id)}.now`]) {
        const words = text[key] ?? "";
        expect({ key, has: words.trim().length > 0 }).toEqual({ key, has: true });
        expect({ key, dashed: DASH.test(words) }).toEqual({ key, dashed: false });
      }
    }
  });

  test("[streets:lagos-street-spending] given the street's eight acts, when their names are read, then each is the rule's thing in the street's words", () => {
    expect(RULE.map((rule) => text[`${rule.id}.name`])).toEqual([
      "A wrap of suya",
      "Tea with the mallam",
      "Cold pure water",
      "A fresh low cut",
      "The match at the viewing centre",
      "A cold one at the joint",
      "A night out",
      "New clothes from Tejuosho",
    ]);
  });
});
