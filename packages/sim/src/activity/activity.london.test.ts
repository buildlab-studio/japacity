// London lived by hand with the real content: docs/rules/streets.md R-STREET-012 (design page 14 section 6) and
// abroad-money.md R-ABROAD-003 as amended 16 Oct 2026. Food is bought and cooked in pounds as it is eaten, the evenings
// are paid as they are had, and the UK's upkeep is the phone alone.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, BaseEvent, Currency, Effect, Id } from "../engine/types";
import { flown } from "../place/place.journey";
import { applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";

const BELLY: Id<"quality"> = "quality.belly";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const ENERGY: Id<"quality"> = "quality.energy";
const body = content.tuning.turn.body;
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];

interface Act {
  id: Id<"activity">;
  price: number;
  reason: "food" | "enjoyment";
  halfDays: number;
  repeat: boolean;
  effects: [Id<"quality">, number][];
}

/** The rule's list, in its order, with its numbers. */
const RULE: readonly Act[] = [
  { id: "activity.weekly-shop-uk", price: 4500, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 40]] },
  { id: "activity.cook-own-uk", price: 600, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 25]] },
  { id: "activity.chicken-shop", price: 700, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 20], [WELLBEING, 4]] },
  { id: "activity.naija-shop-uk", price: 2500, reason: "food", halfDays: 1, repeat: true, effects: [[BELLY, 30], [WELLBEING, 8]] },
  { id: "activity.pub-pint", price: 600, reason: "enjoyment", halfDays: 1, repeat: true, effects: [[WELLBEING, 5], [ENERGY, -3]] },
  { id: "activity.barber-uk", price: 1500, reason: "enjoyment", halfDays: 1, repeat: false, effects: [[WELLBEING, 5], ["quality.standing", 1], ["quality.interview-prep", 2]] },
  { id: "activity.buy-clothes-uk", price: 4000, reason: "enjoyment", halfDays: 2, repeat: false, effects: [["quality.standing", 1], [WELLBEING, 3]] },
];

/** Empties every pocket and leaves the pounds in cash as given. */
function pounds(game: Game, cash: number): void {
  const takes: Effect[] = CURRENCIES.flatMap((currency): Effect[] => {
    const pocket = game.state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash;
    return held === 0 ? [] : [{ type: "money/take", currency, pocket: "any", amount: held, reason: "mishap" }];
  });
  applyEffects(game, [...takes, ...(cash > 0 ? [{ type: "money/add", currency: "GBP", pocket: "cash", amount: cash, reason: "gift" } as const] : [])]);
}

/** Sets each named quality to the middle, so a lift or a fall is never lost to a bound. */
function middling(game: Game, qualities: readonly Id<"quality">[]): void {
  applyEffects(
    game,
    qualities.map((quality): Effect => ({ type: "quality/add", quality, amount: 50 - (game.state.quality[quality] ?? 0) })),
  );
}

function debits(result: Accepted): BaseEvent[] {
  return result.events.filter((event) => event.type === "wallet/debited");
}

describe("London lived by hand", () => {
  test("[R-STREET-012] given each act the rule lists, when its entry is read, then it is a now-act in the UK with the rule's price in pounds under its reason, its time, how often it runs and its lift", () => {
    for (const act of RULE) {
      const entry = content.activity[act.id];
      expect({ id: act.id, entry }).toEqual({
        id: act.id,
        entry: {
          id: act.id,
          slot: "none",
          when: "now",
          ...(act.repeat ? { repeat: true } : {}),
          halfDays: act.halfDays,
          where: "abroad",
          country: "country.uk",
          requires: [{ type: "place/is", where: "abroad", country: "country.uk" }],
          param: null,
          cost: [{ currency: "GBP", amount: act.price, reason: act.reason }],
          pay: null,
          hireBp: null,
          effects: act.effects.map(([quality, amount]) => ({ type: "quality/add", quality, amount })),
          counts: [],
        },
      });
    }
  });

  test("[R-STREET-012] given a life in London holding exactly each act's price, when each is done, then the price leaves the pounds under its reason and the body moves by its lift; a penny short and it is refused", () => {
    for (const act of RULE) {
      const game = flown(content);
      middling(game, [BELLY, WELLBEING, ENERGY, "quality.standing", "quality.interview-prep"]);
      pounds(game, act.price - 1);
      game.expectRejected({ type: "activity/now", activity: act.id, param: null }, "cannot-afford");
      pounds(game, act.price);
      const before = { ...game.state.quality };
      const result = game.accept({ type: "activity/now", activity: act.id, param: null });
      expect({ id: act.id, debits: debits(result) }).toMatchObject({ id: act.id, debits: [{ currency: "GBP", amount: act.price, reason: act.reason }] });
      // The time the act spends takes its little off the body as well (R-QUALITY-007).
      const spent = (quality: Id<"quality">): number => (quality === BELLY ? body.bellyPerHalfDay : quality === ENERGY ? body.energyPerHalfDay : 0) * act.halfDays;
      for (const [quality, amount] of act.effects) {
        expect({ id: act.id, quality, moved: (game.state.quality[quality] ?? 0) - (before[quality] ?? 0) }).toEqual({ id: act.id, quality, moved: amount - spent(quality) });
      }
      expect(game.state.wallet.pockets.GBP.cash).toBe(0);
    }
  });

  test("[R-STREET-012] given a life in London, when the weekly shop is done twice and the barber and the clothes twice in one month, then the shop runs again, filling the belly each time, and the barber and the clothes are once a month", () => {
    const game = flown(content);
    pounds(game, 100000);
    applyEffects(game, [{ type: "quality/add", quality: BELLY, amount: 10 - (game.state.quality[BELLY] ?? 0) }]);
    game.accept({ type: "activity/now", activity: "activity.weekly-shop-uk", param: null });
    game.accept({ type: "activity/now", activity: "activity.weekly-shop-uk", param: null });
    expect(game.state.quality[BELLY]).toBe(10 + 2 * (40 - body.bellyPerHalfDay));
    for (const once of ["activity.barber-uk", "activity.buy-clothes-uk"] as const) {
      game.accept({ type: "activity/now", activity: once, param: null });
      game.expectRejected({ type: "activity/now", activity: once, param: null }, "not-legal");
    }
  });

  test("[R-STREET-012] given a life at home in Lagos, when any of London's acts is asked for, then it is refused", () => {
    const game = start({ content });
    const refused = RULE.map((act) => game.expectRejected({ type: "activity/now", activity: act.id, param: null }, "not-legal").ok);
    expect(refused).toEqual(RULE.map(() => false));
  });

  test("[R-STREET-012] given each act, when its words are read, then its name, blurb and the place's answer resolve with no dash, and the names are the rule's", () => {
    const names = RULE.map((act) => text[`${act.id}.name`]);
    expect(names).toEqual(["The weekly shop", "A meal of your own", "The chicken shop", "A taste of home", "A pint", "A fresh cut", "New clothes"]);
    for (const act of RULE) {
      for (const key of [`${act.id}.blurb`, `line.activity.${act.id.slice("activity.".length)}.now`]) {
        expect({ key, words: (text[key] ?? "").trim().length > 0, dashed: /[–—]/u.test(text[key] ?? "") }).toEqual({ key, words: true, dashed: false });
      }
    }
  });
});

describe("the UK's upkeep", () => {
  test("[R-ABROAD-003] given a life landed in the UK, when its upkeep is read, then it is the phone's pay as you go alone, £15 a month, named so", () => {
    expect(content.obligation["obligation.upkeep-uk"]).toMatchObject({ type: "upkeep", currency: "GBP", amount: 1500 });
    expect(text["obligation.upkeep-uk.name"]).toBe("Your phone, pay as you go, in the UK");
    const game = flown(content);
    expect(Object.values(game.state.obligation.items).find((item) => item.entry === "obligation.upkeep-uk")).toMatchObject({ amount: 1500, state: "active" });
    // Canada, the UAE and Italy keep the whole upkeep until their waves.
    expect([content.obligation["obligation.upkeep-ca"]?.amount, content.obligation["obligation.upkeep-uae"]?.amount, content.obligation["obligation.upkeep-it"]?.amount]).toEqual([60000, 45000, 25000]);
  });
});
