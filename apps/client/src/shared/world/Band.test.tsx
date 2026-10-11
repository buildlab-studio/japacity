// The band's money by where the character is (docs/rules/world.md R-WORLD-002): the naira at home,
// and abroad the country's own money, bank and cash together, from content's country table. And the month's name and
// phase where the pages were (decision 0034; turn.md R-TURN-010): no Next month, no count of anything.
import { content, text } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { createGameStore } from "../../authority/store";
import { localAuthority } from "../../authority/local";
import { abroadGame, engineView, setPockets } from "../testing/fixtures";
import "../testing/render";
import { formatMoney } from "../words/format";
import { Band, bandMoney, bandMonth, bandPlace } from "./Band";
import { nameOf, say } from "../words/text";

/** Noon on 15 March 2026, Lagos. */
const MARCH = Date.UTC(2026, 2, 15, 11);

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

describe("the band's place", () => {
  test("[R-WORLD-002] given a place whose name is long, when the band says it, then it says the place's own short name; a short name stands as it is", () => {
    expect(bandPlace(nameOf("place.bode-thomas"))).toBe("Bode Thomas");
    expect(bandPlace("Your room in Ojuelegba")).toBe("Your room");
    expect(bandPlace(say("ui.inside.hub"))).toBe("The hub");
    expect(bandPlace(nameOf("place.makoko"))).toBe(nameOf("place.makoko"));
    // Every short name is shorter than the name it stands for.
    const longer = Object.entries(text).filter(([key, short]) => key.endsWith(".short") && key.startsWith("place.") && short.length >= (text[key.replace(/\.short$/, ".name")] ?? "").length);
    expect(longer).toEqual([]);
  });
});


describe("the band's month", () => {
  test("[R-WORLD-002] [R-TURN-010] given a life begun in March at month 1 with 30 of 60 half-days spent, when the band renders, then a small chip says April and Mid, with no digit, no count of days and no end-month button, and a tap on it opens the Calendar", () => {
    const view: PlayerView = { ...engineView(), month: 1, halfDays: { spent: 30, free: 60 } };
    const month = bandMonth(view, MARCH);
    expect(month).toEqual({ name: "April", phase: "Mid" });
    const onMonth = vi.fn();
    render(<Band when="23 yrs 4 mo" name="The family house" money={42_000_000} formatMoney={(value) => formatMoney(value, "NGN")} month={month} onMonth={onMonth} />);
    const chip = document.querySelector<HTMLElement>("[data-band-month]");
    if (chip === null) throw new Error("No month on the band");
    expect(chip.textContent).toContain("April");
    expect(chip.textContent).toContain("Mid");
    expect(chip.textContent).not.toMatch(/\d/);
    const band = document.querySelector("[data-band]")?.textContent ?? "";
    expect(band).not.toMatch(/\bdays?\b|pages?|%|Next month|left/i);
    expect(document.querySelector("[data-end-month]")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.world.end-month") })).toBeNull();
    fireEvent.click(chip);
    expect(onMonth).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-002] [R-TURN-010] given the month lived to its end, and a fresh one, when the band's month is read, then it says Month end, then Early", () => {
    const view: PlayerView = { ...engineView(), month: 0, halfDays: { spent: 20, free: 20 } };
    expect(bandMonth(view, MARCH)).toEqual({ name: "March", phase: "Month end" });
    expect(bandMonth({ ...view, halfDays: { spent: 0, free: 60 } }, MARCH)).toEqual({ name: "March", phase: "Early" });
  });

  test("[R-WORLD-002] given a life begun on this device in March, when the store starts it, then the store holds the time it began, read from the authority", async () => {
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "band-month", now: () => MARCH });
    const store = createGameStore(authority, { life: authority, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    expect(store.getState().beganAt).toBe(MARCH);
    expect(authority.beganAt()).toBe(MARCH);
  });
});
