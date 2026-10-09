// The band's money by where the character is (docs/rules/world.md R-WORLD-002): the naira at home,
// and abroad the country's own money, bank and cash together, from content's country table.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadGame, engineView, setPockets } from "../testing/fixtures";
import { formatMoney } from "../words/format";
import { bandMoney } from "./Band";

const ABROAD = ["country.uk", "country.uae", "country.canada", "country.italy"] as const;

/** Ada landed in London, with pounds in the bank and in her hand. */
function landed(): PlayerView {
  const game = abroadGame();
  setPockets(game, { GBP: 70_000 });
  return game.view();
}

describe("the band's money", () => {
  test("[R-WORLD-002] given a life at home, when the band's money is read, then it is the naira in cash and bank together", () => {
    const view = engineView();
    const money = bandMoney(view);
    expect(money.money).toBe(view.pockets.NGN.cash + view.pockets.NGN.bank);
    expect(money.formatMoney(15_000_000)).toBe(formatMoney(15_000_000, "NGN"));
  });

  test("[R-WORLD-002] given Ada landed in London with naira still at home, when the band's money is read, then it is her pounds, bank and cash together, and the naira is left to the Bank app", () => {
    const view = landed();
    expect(view.place).toMatchObject({ where: "abroad", country: "country.uk" });
    expect(view.pockets.NGN.bank).toBeGreaterThan(0);
    const money = bandMoney(view);
    expect(money.money).toBe(view.pockets.GBP.bank + view.pockets.GBP.cash);
    expect(money.money).toBe(70_000);
    expect(money.formatMoney(money.money)).toBe(formatMoney(70_000, "GBP"));
    expect(money.formatMoney(money.money)).toContain("£");
  });

  test("[R-WORLD-002] given each country abroad, when the band's money is read, then it is that country's currency in content, cash and bank together, and never the naira", () => {
    const base = landed();
    for (const country of ABROAD) {
      const currency: Currency = content.country[country]?.currency ?? "NGN";
      expect(currency).not.toBe("NGN");
      const view: PlayerView = { ...base, place: { ...base.place, country }, pockets: { ...base.pockets, [currency]: { bank: 70_000, cash: 4_600, locked: 0 } } };
      const money = bandMoney(view);
      expect({ country, money: money.money, shown: money.formatMoney(74_600) }).toEqual({ country, money: 74_600, shown: formatMoney(74_600, currency) });
    }
  });
});
