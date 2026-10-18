// Calgary, Dubai and Castel Volturno lived by hand with the real content: docs/rules/streets.md R-STREET-013 to
// R-STREET-015 (design page 15 section 5), abroad-money.md R-ABROAD-003, home.md R-HOME-012 and
// obligation.md R-OBLIGATION-014. Food is bought and cooked in each country's money as it is
// eaten, the evenings are paid as they are had, and each upkeep is the prepaid phone alone.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Currency, Effect, Id } from "../engine/types";
import { applyEffects, middling } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { debits } from "../testing/read";
import { BELLY, CANADA_COUNTRY, ENERGY, ITALY, NETWORK, PREP, STANDING, UAE, WELLBEING } from "../testing/ids";

const body = content.tuning.turn.body;
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const MONEY: Readonly<Record<string, Currency>> = { [CANADA_COUNTRY]: "CAD", [UAE]: "AED", [ITALY]: "EUR" };

interface Act {
  id: Id<"activity">;
  country: Id<"country">;
  price: number;
  reason: "food" | "enjoyment";
  /** Half-days spent, or null for a purchase, which spends none and runs as often as money allows. */
  halfDays: number | null;
  repeat: boolean;
  effects: [Id<"quality">, number][];
  name: string;
}

/** The rules' lists, in their order, with their numbers and names. */
const RULE: readonly Act[] = [
  // R-STREET-013, Calgary.
  { id: "activity.weekly-shop-ca", country: CANADA_COUNTRY, price: 9000, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 40]], name: "The weekly shop" },
  { id: "activity.buy-clothes-ca", country: CANADA_COUNTRY, price: 12000, reason: "enjoyment", halfDays: 2, repeat: false, effects: [[STANDING, 1], [WELLBEING, 4]], name: "Winter clothes" },
  { id: "activity.cook-own-ca", country: CANADA_COUNTRY, price: 800, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 25]], name: "A meal of your own" },
  { id: "activity.coffee-ca", country: CANADA_COUNTRY, price: 300, reason: "enjoyment", halfDays: null, repeat: false, effects: [[WELLBEING, 2]], name: "A coffee" },
  { id: "activity.naija-shop-ca", country: CANADA_COUNTRY, price: 4000, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 30], [WELLBEING, 8]], name: "The African store" },
  { id: "activity.barber-ca", country: CANADA_COUNTRY, price: 3000, reason: "enjoyment", halfDays: 1, repeat: false, effects: [[WELLBEING, 5], [STANDING, 1], [PREP, 2]], name: "A fresh cut" },
  // R-STREET-014, Dubai.
  { id: "activity.weekly-shop-uae", country: UAE, price: 15000, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 40]], name: "The weekly shop" },
  { id: "activity.cook-own-uae", country: UAE, price: 800, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 25]], name: "A meal of your own" },
  { id: "activity.cafeteria-uae", country: UAE, price: 1200, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 25], [WELLBEING, 3]], name: "The cafeteria" },
  { id: "activity.naija-shop-uae", country: UAE, price: 6000, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 30], [WELLBEING, 8]], name: "The African foods shop" },
  { id: "activity.barber-uae", country: UAE, price: 2500, reason: "enjoyment", halfDays: 1, repeat: false, effects: [[WELLBEING, 5], [STANDING, 1]], name: "A fresh cut" },
  { id: "activity.buy-clothes-uae", country: UAE, price: 8000, reason: "enjoyment", halfDays: 2, repeat: false, effects: [[STANDING, 1], [WELLBEING, 3]], name: "The tailor" },
  { id: "activity.laundry-uae", country: UAE, price: 2000, reason: "enjoyment", halfDays: 1, repeat: true, effects: [[WELLBEING, 2]], name: "The laundry" },
  // R-STREET-015, Castel Volturno.
  { id: "activity.weekly-shop-it", country: ITALY, price: 3500, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 40]], name: "The weekly shop" },
  { id: "activity.cook-own-it", country: ITALY, price: 400, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 25]], name: "A meal of your own" },
  { id: "activity.coffee-it", country: ITALY, price: 120, reason: "enjoyment", halfDays: null, repeat: false, effects: [[WELLBEING, 2]], name: "A coffee at the bar" },
  { id: "activity.naija-shop-it", country: ITALY, price: 2000, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 30], [WELLBEING, 8]], name: "The African shop" },
  { id: "activity.barber-it", country: ITALY, price: 1000, reason: "enjoyment", halfDays: 1, repeat: false, effects: [[WELLBEING, 5], [STANDING, 1]], name: "A fresh cut" },
  { id: "activity.buy-clothes-it", country: ITALY, price: 2500, reason: "enjoyment", halfDays: 2, repeat: false, effects: [[STANDING, 1], [WELLBEING, 3]], name: "Clothes from the stall" },
  { id: "activity.street-shopping-it", country: ITALY, price: 1500, reason: "enjoyment", halfDays: 1, repeat: true, effects: [[WELLBEING, 5]], name: "An evening at the Nigerian shop" },
];

function currencyOf(country: Id<"country">): Currency {
  const currency = MONEY[country];
  if (currency === undefined) throw new Error(`No money for ${country}.`);
  return currency;
}

/** A life landed in the country with the country's money in cash as given, every other pocket emptied. */
function landed(country: Id<"country">, cash: number): Game {
  const game = start({ content, scenario: "scenario.ada" });
  applyEffects(game, [{ type: "place/move", to: "abroad", country }]);
  money(game, country, cash);
  return game;
}

function money(game: Game, country: Id<"country">, cash: number): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [...takes, ...(cash > 0 ? [{ type: "money/add", currency: currencyOf(country), pocket: "cash", amount: cash, reason: "gift" } as const] : [])]);
}

describe("the three countries lived by hand", () => {
  test("[R-STREET-013] [R-STREET-014] [R-STREET-015] given each act the rules list, when its entry is read, then it is a now-act in its country with the rule's price in its money under its reason, its time, how often it runs and its lift", () => {
    for (const act of RULE) {
      const entry = content.activity[act.id];
      const when = act.halfDays === null ? { when: "now", purchase: true } : { when: "now", ...(act.repeat ? { repeat: true } : {}), halfDays: act.halfDays };
      expect({ id: act.id, entry }).toEqual({
        id: act.id,
        entry: {
          id: act.id,
          slot: "none",
          ...when,
          where: "abroad",
          country: act.country,
          requires: [{ type: "place/is", where: "abroad", country: act.country }],
          param: null,
          cost: [{ currency: currencyOf(act.country), amount: act.price, reason: act.reason }],
          pay: null,
          hireBp: null,
          effects: act.effects.map(([quality, amount]) => ({ type: "quality/add", quality, amount })),
          counts: [],
        },
      });
    }
  });

  test("[R-STREET-013] [R-STREET-014] [R-STREET-015] given a life in each country holding exactly each act's price, when each is done, then the price leaves the country's money under its reason and the body moves by its lift; a cent short and it is refused", () => {
    for (const act of RULE) {
      const game = landed(act.country, act.price - 1);
      middling(game, [BELLY, WELLBEING, ENERGY, STANDING, PREP]);
      game.expectRejected({ type: "activity/now", activity: act.id, param: null }, "cannot-afford");
      money(game, act.country, act.price);
      const before = { ...game.state.quality };
      const result = game.accept({ type: "activity/now", activity: act.id, param: null });
      expect({ id: act.id, debits: debits(result) }).toMatchObject({ id: act.id, debits: [{ currency: currencyOf(act.country), amount: act.price, reason: act.reason }] });
      const halfDays = act.halfDays ?? 0;
      const spent = (quality: Id<"quality">): number => (quality === BELLY ? body.bellyPerHalfDay : quality === ENERGY ? body.energyPerHalfDay : 0) * halfDays;
      for (const [quality, amount] of act.effects) {
        expect({ id: act.id, quality, moved: (game.state.quality[quality] ?? 0) - (before[quality] ?? 0) }).toEqual({ id: act.id, quality, moved: amount - spent(quality) });
      }
      expect(game.state.wallet.pockets[currencyOf(act.country)].cash).toBe(0);
    }
  });

  test("[R-STREET-013] [R-STREET-014] [R-STREET-015] given a life in each country, when a repeating act is done twice and a once-a-month act twice, then the first runs again and the second is refused; a coffee runs as often as money allows", () => {
    const again = RULE.map((act) => {
      const game = landed(act.country, act.price * 3);
      middling(game, [BELLY, WELLBEING, ENERGY, STANDING, PREP]);
      game.accept({ type: "activity/now", activity: act.id, param: null });
      const command = { type: "activity/now", activity: act.id, param: null } as const;
      const runs = act.repeat || act.halfDays === null;
      return { id: act.id, again: runs ? game.accept(command).ok : game.expectRejected(command, "not-legal").ok };
    });
    expect(again).toEqual(RULE.map((act) => ({ id: act.id, again: act.repeat || act.halfDays === null })));
  });

  test("[R-STREET-013] [R-STREET-014] [R-STREET-015] given a life at home and a life in another country, when any of the acts is asked for, then it is refused", () => {
    const home = start({ content });
    for (const act of RULE) {
      expect({ id: act.id, ok: home.expectRejected({ type: "activity/now", activity: act.id, param: null }, "not-legal").ok }).toEqual({ id: act.id, ok: false });
      const elsewhere = landed(act.country === CANADA_COUNTRY ? UAE : CANADA_COUNTRY, 1_000_000);
      expect({ id: act.id, ok: elsewhere.expectRejected({ type: "activity/now", activity: act.id, param: null }, "not-legal").ok }).toEqual({ id: act.id, ok: false });
    }
  });

  test("[R-STREET-013] [R-STREET-014] [R-STREET-015] given each act, when its words are read, then its name is the rule's and its blurb and the place's answer resolve with no dash", () => {
    for (const act of RULE) {
      expect({ id: act.id, name: text[`${act.id}.name`] }).toEqual({ id: act.id, name: act.name });
      for (const key of [`${act.id}.blurb`, `line.activity.${act.id.slice("activity.".length)}.now`]) {
        expect({ key, words: (text[key] ?? "").trim().length > 0, dashed: /[\u2013\u2014]/u.test(text[key] ?? "") }).toEqual({ key, words: true, dashed: false });
      }
    }
  });
});

describe("the church in Castel Volturno and the souq in Naif", () => {
  test("[R-STREET-015] given a life in Castel Volturno, when the church's community is joined, then it is free, takes a morning, lifts the network and the mood by four each, and is once a month", () => {
    expect(content.activity["activity.community-it"]).toMatchObject({ slot: "free", when: "now", halfDays: 1, where: "abroad", country: ITALY, cost: [] });
    const game = landed(ITALY, 0);
    middling(game, [NETWORK, WELLBEING]);
    const before = { ...game.state.quality };
    game.accept({ type: "activity/now", activity: "activity.community-it", param: null });
    expect((game.state.quality[NETWORK] ?? 0) - (before[NETWORK] ?? 0)).toBe(4);
    expect((game.state.quality[WELLBEING] ?? 0) - (before[WELLBEING] ?? 0)).toBe(4);
    game.expectRejected({ type: "activity/now", activity: "activity.community-it", param: null }, "not-legal");
    expect(text["activity.community-it.name"]).toBe("The church");
  });

  test("[R-STREET-014] given the souq, when its entry is read, then it keeps its price and lift and is paid as enjoyment", () => {
    expect(content.activity["activity.street-shopping-uae"]?.cost).toEqual([{ currency: "AED", amount: content.tuning.street.shoppingAed, reason: "enjoyment" }]);
    expect(content.activity["activity.street-shopping-uae"]?.effects).toEqual([{ type: "quality/add", quality: WELLBEING, amount: content.tuning.street.shoppingMood }]);
  });
});

const UPKEEPS = [
  { country: CANADA_COUNTRY, id: "obligation.upkeep-ca" as Id<"obligation">, currency: "CAD", amount: 3000, name: "Your phone, prepaid, in Canada" },
  { country: UAE, id: "obligation.upkeep-uae" as Id<"obligation">, currency: "AED", amount: 5000, name: "Your phone, prepaid, in Dubai" },
  { country: ITALY, id: "obligation.upkeep-it" as Id<"obligation">, currency: "EUR", amount: 1000, name: "Your phone, prepaid, in Italy" },
] as const;

describe("the three upkeeps", () => {
  test("[R-ABROAD-003] given a life landed in each country, when its upkeep is read, then it is the prepaid phone alone, C$30, AED 50 and €10 a month, named so", () => {
    for (const upkeep of UPKEEPS) {
      expect(content.obligation[upkeep.id]).toMatchObject({ type: "upkeep", currency: upkeep.currency, amount: upkeep.amount });
      expect(text[`${upkeep.id}.name`]).toBe(upkeep.name);
      const game = landed(upkeep.country, 0);
      expect(Object.values(game.state.obligation.items).find((item) => item.entry === upkeep.id)).toMatchObject({ amount: upkeep.amount, state: "active" });
    }
    // No line of content still names food and transport as an upkeep.
    expect(Object.entries(text).filter(([key, words]) => key.startsWith("obligation.") && /food and transport/i.test(words))).toEqual([]);
  });
});

describe("the room abroad cooks in the country's money", () => {
  test("[R-HOME-012] [R-OBLIGATION-014] given a life in each country, when the meal of the country is cooked, then it is paid in that money as food, nothing is relieved, and the naira meal is refused", () => {
    for (const [country, meal] of [
      [CANADA_COUNTRY, "activity.cook-own-ca"],
      [UAE, "activity.cook-own-uae"],
      [ITALY, "activity.cook-own-it"],
    ] as const) {
      const game = landed(country, 10000);
      const cooked = game.accept({ type: "activity/now", activity: meal, param: null });
      expect({ meal, debits: debits(cooked) }).toMatchObject({ meal, debits: [{ currency: currencyOf(country), reason: "food" }] });
      expect(cooked.events.filter((event) => event.type === "obligation/relieved")).toEqual([]);
      const upkeep = Object.values(game.state.obligation.items).find((item) => content.obligation[item.entry]?.type === "upkeep");
      expect({ meal, upkeep: upkeep?.entry, relief: upkeep?.relief ?? [] }).toEqual({ meal, upkeep: content.country[country]?.upkeep, relief: [] });
      game.expectRejected({ type: "activity/now", activity: "activity.cook-own", param: null }, "not-legal");
    }
    expect(content.place["place.the-room"]?.stages).toEqual(expect.arrayContaining(["activity.cook-own-uk", "activity.cook-own-ca", "activity.cook-own-uae", "activity.cook-own-it"]));
  });
});
