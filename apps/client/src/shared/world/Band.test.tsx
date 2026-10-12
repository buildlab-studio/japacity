// The band's money by where the character is (docs/rules/world.md R-WORLD-002): the naira at home,
// and abroad the country's own money, bank and cash together, from content's country table. And the month's name with
// the world's part of the day where the pages were (decision 0036; clock.md R-CLOCK-033): no Next month, no count of
// anything, never a clock time.
import { content, text } from "@japacity/content";
import { type Currency, type PlayerView, time, worldClockAt } from "@japacity/sim";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { localAuthority } from "../../authority/local";
import { abroadGame, engineView, fakeAuthority, setPockets } from "../testing/fixtures";
import "../testing/render";
import { formatMoney } from "../words/format";
import { Band, bandMoney, bandMonth, bandPlace } from "./Band";
import { DAY_CLOCK_MS, dayClockOf, devClockPart, useDayClock } from "./dayClock";
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
  test("[R-WORLD-002] [R-CLOCK-033] given a life begun in March at month 1 and the world's clock in the evening, when the band renders, then a small chip says April and Evening, with no digit, no count of days, no clock time and no end-month button, and a tap on it opens the Calendar", () => {
    const view: PlayerView = { ...engineView(), month: 1, halfDays: { spent: 2, free: 60 } };
    const month = bandMonth(view, MARCH, { part: "evening" });
    expect(month).toEqual({ name: "April", part: "Evening" });
    const onMonth = vi.fn();
    render(<Band when="23 yrs 4 mo" name="The family house" money={42_000_000} formatMoney={(value) => formatMoney(value, "NGN")} month={month} onMonth={onMonth} />);
    const chip = document.querySelector<HTMLElement>("[data-band-month]");
    if (chip === null) throw new Error("No month on the band");
    expect(chip.textContent).toBe("AprilEvening");
    expect(chip.textContent).not.toMatch(/\d/);
    const band = document.querySelector("[data-band]")?.textContent ?? "";
    expect(band).not.toMatch(/\bdays?\b|pages?|%|Next month|left|\d:\d\d|Early|Mid|Late|Month end/i);
    expect(document.querySelector("[data-end-month]")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.world.end-month") })).toBeNull();
    fireEvent.click(chip);
    expect(onMonth).toHaveBeenCalledTimes(1);
  });

  test("[R-CLOCK-033] [R-WORLD-002] given the month's time all spent or none of it, when the band's month is read, then the part of the day is the world's clock's whichever way the month stands", () => {
    const parts = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["night", "Night"]] as const;
    for (const [part, words] of parts) {
      const spent: PlayerView = { ...engineView(), month: 0, halfDays: { spent: 20, free: 20 } };
      const fresh: PlayerView = { ...engineView(), month: 0, halfDays: { spent: 0, free: 60 } };
      expect(bandMonth(spent, MARCH, { part })).toEqual({ name: "March", part: words });
      expect(bandMonth(fresh, MARCH, { part })).toEqual({ name: "March", part: words });
    }
  });

  test("[R-CLOCK-033] given the band in a game with no reply's clock, when it renders on the device and a minute passes, then its part of the day is the world's clock at the device's time, and a reply's clock wins as it lands", () => {
    vi.useFakeTimers();
    try {
      // 21:50 of a game day: the evening, ten game minutes from the night.
      const day = time.GAME_DAY_MS;
      const evening = time.GAME_DAY_EPOCH_MS + day * 3 + (day * (21 * 60 + 50)) / 1440;
      vi.setSystemTime(evening);
      expect(worldClockAt(evening).part).toBe("evening");
      const authority = fakeAuthority(engineView());
      const store = createGameStore(authority);
      function Shown() {
        const clock = useDayClock();
        return <Band when="23 yrs" name="Home" money={0} formatMoney={String} month={bandMonth(engineView(), MARCH, clock)} />;
      }
      render(
        <GameProvider store={store}>
          <Shown />
        </GameProvider>,
      );
      const part = (): string => document.querySelector("[data-band-part]")?.textContent ?? "";
      expect(part()).toBe("Evening");
      // A real minute is twelve game minutes: past ten at night.
      act(() => {
        vi.advanceTimersByTime(DAY_CLOCK_MS);
      });
      expect(part()).toBe("Night");
      // A reply's clock wins over the device's until the device reads again.
      act(() => store.setState({ clock: { tick: 0, nextTickAt: 0, nextTurnAt: null, morningAt: 0, world: { ...worldClockAt(evening), part: "afternoon" } } }));
      expect(part()).toBe("Afternoon");
      act(() => {
        vi.advanceTimersByTime(DAY_CLOCK_MS);
      });
      expect(part()).toBe("Night");
    } finally {
      vi.useRealTimers();
    }
  });

  test("[R-CLOCK-033] given the development switch for the clock, when it is read, then a development build stands at the part asked for, and a build for players never does", () => {
    expect(devClockPart("?clock=night", true)).toBe("night");
    expect(devClockPart("?clock=morning&x=1", true)).toBe("morning");
    expect(devClockPart("?clock=noon", true)).toBeNull();
    expect(devClockPart("", true)).toBeNull();
    expect(devClockPart("?clock=night", false)).toBeNull();
    const clock = worldClockAt(time.GAME_DAY_EPOCH_MS);
    expect(dayClockOf(null, clock, "night")).toEqual({ ...clock, part: "night" });
    expect(dayClockOf(null, clock, null)).toBe(clock);
  });

  test("[R-WORLD-002] given a life begun on this device in March, when the store starts it, then the store holds the time it began, read from the authority", async () => {
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "band-month", now: () => MARCH });
    const store = createGameStore(authority, { life: authority, choosingLife: true });
    await store.getState().chooseLife("scenario.ada");
    expect(store.getState().beganAt).toBe(MARCH);
    expect(authority.beganAt()).toBe(MARCH);
  });
});
