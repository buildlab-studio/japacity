import type { ReportLine, World } from "@japacity/sim";
import { time } from "@japacity/sim";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { fakeAuthority, engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say, sayCount, words } from "../../shared/words/text";
import { closesAt } from "./draw";
import { LotteryView } from "./LotteryView";
import { drawnReply, drawOf, onlineLife, tuning, type Draw } from "./testing";
import { closeWords, waitWords } from "./when";

const NOW = Date.UTC(2026, 9, 7, 12);
const NEXT_TICK = NOW + 6 * time.HOUR_MS;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** The kiosk over an online life whose world runs `lottery`, with the server's clock at tick 10. */
async function kiosk(lottery: World["lottery"]): Promise<{ store: GameStore; life: ReturnType<typeof onlineLife> }> {
  const life = onlineLife(lottery);
  const store = createGameStore(life.authority);
  await store.getState().refresh();
  store.getState().heard({ kind: "clock", clock: { tick: 10, nextTickAt: NEXT_TICK, nextTurnAt: null } });
  render(
    <GameProvider store={store}>
      <LotteryView load={null} />
    </GameProvider>,
  );
  return { store, life };
}

const money = (amount: number) => formatMoney(amount, "NGN");

describe("the kiosk", () => {
  test("[R-LOTTERY-001] given the world runs no draw, when the money tab is shown, then there is no kiosk and the luck kiosk is among the month's activities", async () => {
    await kiosk(null);
    expect(screen.queryByText(say("ui.lottery.title"))).toBeNull();
    expect(onlineLife(null).game.view().activities.find((option) => option.id === "activity.play-lotto")?.allowed).toBe(true);
  });

  test("[R-LOTTERY-006] given a draw on sale, when the kiosk is shown, then it shows the price and cap, the tickets held, the close as a real time counting down, the pot so far and the fingerprint", async () => {
    await kiosk(drawOf({ closesTick: 14 }));
    const at = NEXT_TICK + 3 * time.WORLD_TICK_MS;
    expect(closesAt({ closesTick: 14 }, { tick: 10, nextTickAt: NEXT_TICK })).toBe(at);
    expect(screen.getByText(say("ui.lottery.title"))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.draw", { draw: 7 }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.price", { price: money(tuning.ticket), max: tuning.maxTickets }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.held.zero"))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.closes", { when: closeWords(at) }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.closes-in", { wait: waitWords(at - NOW) }))).toBeDefined();
    expect(waitWords(at - NOW)).toBe(say("ui.lottery.days", { days: 1, hours: 18 }));
    expect(screen.getByText(money(3 * tuning.ticket))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.from-sales", { sales: money(3 * tuning.ticket) }))).toBeDefined();
    expect(document.querySelector("[data-lottery-fingerprint]")?.textContent).toBe("ab".repeat(32));
    expect(screen.queryByText(say("ui.lottery.round", { round: formatNumber(1234) }))).toBeNull();
  });

  test("[R-LOTTERY-006] given the close one minute and then no time away, when the clock runs, then the countdown reaches the close and says the sales are closed", async () => {
    await kiosk(drawOf({ closesTick: 11 }));
    vi.setSystemTime(NEXT_TICK - time.MINUTE_MS - 1000);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(say("ui.lottery.closes-in", { wait: say("ui.clock.minutes", { minutes: 1 }) }))).toBeDefined();
    vi.setSystemTime(NEXT_TICK - 1000);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(say("ui.lottery.closed"))).toBeDefined();
  });

  test("[R-LOTTERY-003] given a draw on sale, when two tickets are picked and bought, then lottery/buy goes with 2 and the kiosk shows them held and their price gone from the bank", async () => {
    const { life } = await kiosk(drawOf());
    const bank = life.game.state.wallet.pockets.NGN.bank;
    fireEvent.click(screen.getByRole("button", { name: say("ui.lottery.more") }));
    const buy = screen.getByRole("button", { name: say("ui.lottery.buy", { count: 2, cost: money(2 * tuning.ticket) }) });
    await act(async () => {
      fireEvent.click(buy);
      await Promise.resolve();
    });
    expect(life.authority.sent.at(-1)).toMatchObject({ type: "lottery/buy", tickets: 2 });
    expect(life.game.state.wallet.pockets.NGN.bank).toBe(bank - 2 * tuning.ticket);
    expect(screen.getByText(sayCount("ui.lottery.held", 2, { count: 2 }))).toBeDefined();
  });

  test("[R-LOTTERY-003] given tickets held, when more are picked, then the picker stops at the cap, and at the cap there is nothing to buy", async () => {
    const { life } = await kiosk(drawOf());
    const more = screen.getByRole("button", { name: say("ui.lottery.more") });
    for (let press = 0; press < tuning.maxTickets + 2; press += 1) fireEvent.click(more);
    expect(document.querySelector("[data-lottery-count]")?.textContent).toBe(String(tuning.maxTickets));
    expect(more).toHaveProperty("disabled", true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: say("ui.lottery.buy", { count: tuning.maxTickets, cost: money(tuning.maxTickets * tuning.ticket) }) }));
      await Promise.resolve();
    });
    expect(life.game.state.lottery.tickets).toBe(tuning.maxTickets);
    expect(screen.getByText(say("ui.lottery.full"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.lottery.more") })).toBeNull();
  });

  test("[R-LOTTERY-003] given a naira bank one kobo short of a ticket, when the kiosk is shown, then it says so and offers no purchase", async () => {
    const life = onlineLife(drawOf());
    const over = life.game.state.wallet.pockets.NGN.bank - (tuning.ticket - 1);
    life.game.accept({ type: "wallet/move", currency: "NGN", amount: over, to: "cash" });
    const store = createGameStore(life.authority);
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <LotteryView load={null} />
      </GameProvider>,
    );
    expect(screen.getByText(say("ui.lottery.short", { bank: money(tuning.ticket - 1) }))).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
  });

  test("[R-LOTTERY-006] given the world's own row for the draw, when the fingerprint is opened, then the public round it will be drawn with is shown", async () => {
    const { store } = await kiosk(drawOf());
    act(() => store.setState({ world: { tick: 10, nextTickAt: NEXT_TICK, world: { ...onlineLife(drawOf()).game.world(), lottery: drawOf() } } }));
    expect(screen.getByText(say("ui.lottery.round", { round: formatNumber(1234) }))).toBeDefined();
  });
});

describe("the house top-up on the kiosk", () => {
  const declared = (sold: number): Draw => drawOf({ topUpTickets: tuning.topUpTickets, potSoFar: sold * tuning.ticket });

  test("[R-LOTTERY-023] given a declared top-up and few sales, when the kiosk is shown, then the pot is shown whole, with the sales and the house's part apart", async () => {
    await kiosk(declared(3));
    const worth = tuning.topUpTickets * tuning.ticket;
    expect(screen.getByText(money(worth))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.from-sales", { sales: money(3 * tuning.ticket) }))).toBeDefined();
    expect(
      screen.getByText(say("ui.lottery.top-up", { tickets: formatNumber(tuning.topUpTickets), worth: money(worth), soFar: money(worth - 3 * tuning.ticket) })),
    ).toBeDefined();
  });

  test("[R-LOTTERY-023] given sales past the declared number, when the kiosk is shown, then it says the house adds nothing, and the pot is the sales", async () => {
    await kiosk(declared(tuning.topUpTickets + 1));
    expect(screen.getByText(say("ui.lottery.top-up-done", { tickets: formatNumber(tuning.topUpTickets) }))).toBeDefined();
    expect(screen.getAllByText(money((tuning.topUpTickets + 1) * tuning.ticket)).length).toBeGreaterThan(0);
  });

  test("[R-LOTTERY-023] given no top-up declared, when the kiosk is shown, then there is no top-up line", async () => {
    await kiosk(drawOf({ topUpTickets: 0 }));
    expect(document.querySelector("[data-lottery-top-up]")).toBeNull();
  });

  test("[R-LOTTERY-023] given the last draw had a top-up, when the kiosk is shown, then the last draw shows the house's part of its pot, and one without shows none", async () => {
    const withTopUp = drawnReply(6, 30, 100).result!;
    await kiosk(drawOf({ last: withTopUp }));
    const last = document.querySelector<HTMLElement>("[data-lottery-last]")!;
    expect(within(last).getByText(say("ui.lottery.last-line", { draw: 6, count: formatNumber(30), pot: money(withTopUp.pot) }))).toBeDefined();
    expect(within(last).getByText(say("ui.lottery.last-top-up", { topUp: money(70 * tuning.ticket) }))).toBeDefined();
    expect(within(last).getByText(say("ui.lottery.tier.jackpot"))).toBeDefined();
  });
});

describe("the win letter", () => {
  const letterOf = (prizes: { tier: "jackpot" | "mid" | "small"; amount: number; topUp: number }[]): ReportLine => {
    const life = onlineLife(drawOf());
    const paid = life.game.accept({ type: "lottery/pay", draw: 7, prizes }, "authority");
    return paid.lines.find((line) => line.key === "line.lottery.letter")!;
  };

  test("[R-LOTTERY-013] given a jackpot or a mid prize paid, when its letter reaches the screen, then it is staged as a moment of its own and marked as needing the player", async () => {
    for (const tier of ["jackpot", "mid"] as const) {
      const letter = letterOf([{ tier, amount: 1_320_000, topUp: 320_000 }]);
      expect(letter).toMatchObject({ big: true, attention: true });
      const authority = fakeAuthority(engineView());
      const store = createGameStore(authority);
      await store.getState().refresh();
      authority.linesNext([letter]);
      await store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
      expect(store.getState().moments).toEqual([letter]);
      expect(words(letter.key, letter.params)).toBe(words("line.lottery.letter", { draw: 7, won: { currency: "NGN", amount: 1_320_000 } }));
    }
  });

  test("[R-LOTTERY-013] given only a small prize paid, when its letter reaches the screen, then it is not staged and still needs the player", async () => {
    const letter = letterOf([{ tier: "small", amount: 165_000, topUp: 0 }]);
    expect(letter).toMatchObject({ big: false, attention: true });
    const authority = fakeAuthority(engineView());
    const store = createGameStore(authority);
    await store.getState().refresh();
    authority.linesNext([letter]);
    await store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
    expect(store.getState().moments).toEqual([]);
    expect(store.getState().lines).toEqual([letter]);
  });
});
