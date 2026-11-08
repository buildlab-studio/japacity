import type { ReportLine, World } from "@japacity/sim";
import { time, worldClockAt } from "@japacity/sim";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { remoteAuthority } from "../../authority/remote";
import { fakeAuthority, engineView } from "../../shared/testing/fixtures";
import { BASE, fakeServer } from "../../shared/testing/server";
import "../../shared/testing/render";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say, sayCount, words } from "../../shared/words/text";
import { closesAt } from "./draw";
import { LotteryView } from "./LotteryView";
import { drawnReply, drawOf, onlineLife, tuning } from "./lottery.testing";
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
  store.getState().heard({ kind: "clock", clock: { tick: 10, nextTickAt: NEXT_TICK, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) } });
  render(
    <GameProvider store={store}>
      <LotteryView load={null} />
    </GameProvider>,
  );
  return { store, life };
}

const money = (amount: number) => formatMoney(amount, "NGN");

describe("the kiosk", () => {
  test("[lottery:draw-runs-online-only] given the world runs no draw, when the money tab is shown, then there is no kiosk and the luck kiosk is among the month's activities", async () => {
    await kiosk(null);
    expect(screen.queryByText(say("ui.lottery.title"))).toBeNull();
    expect(onlineLife(null).game.view().activities.find((option) => option.id === "activity.play-lotto")?.allowed).toBe(true);
  });

  test("[lottery:view-shows-draw-state] given a draw on sale, when the kiosk is shown, then it shows the price and cap, the tickets held, the close as a real time counting down, the jackpot standing and the fingerprint", async () => {
    await kiosk(drawOf({ closesTick: 14 }));
    const at = NEXT_TICK + 3 * time.WORLD_TICK_MS;
    expect(closesAt({ closesTick: 14 }, { tick: 10, nextTickAt: NEXT_TICK })).toBe(at);
    expect(screen.getByText(say("ui.lottery.title"))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.draw", { draw: 7 }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.price", { price: money(tuning.ticket), max: tuning.maxTickets }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.held.zero"))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.closes", { when: closeWords(at) }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.closes-in", { wait: waitWords(at - NOW) }))).toBeDefined();
    expect(waitWords(at - NOW)).toBe("1 day 18 hours");
    expect(document.querySelector("[data-lottery-jackpot]")?.textContent).toContain(money(tuning.odds.jackpotStart));
    expect(document.querySelector("[data-lottery-fingerprint]")?.textContent).toBe("ab".repeat(32));
    expect(screen.queryByText(say("ui.lottery.round", { round: formatNumber(1234) }))).toBeNull();
  });

  test("[lottery:view-shows-draw-state] given waits at each unit's edges, when they are said, then they are whole words with no abbreviation", () => {
    const minute = time.MINUTE_MS;
    const hour = 60 * minute;
    const day = 24 * hour;
    expect(waitWords(minute - 1)).toBe("less than a minute");
    expect(waitWords(minute)).toBe("1 minute");
    expect(waitWords(hour - 1)).toBe("59 minutes");
    expect(waitWords(hour)).toBe("1 hour");
    expect(waitWords(hour + 5 * minute)).toBe("1 hour 5 minutes");
    expect(waitWords(day - 1)).toBe("23 hours 59 minutes");
    expect(waitWords(day)).toBe("1 day");
    expect(waitWords(day + 6 * hour)).toBe("1 day 6 hours");
    expect(waitWords(2 * day + hour)).toBe("2 days 1 hour");
  });

  test("[lottery:view-shows-draw-state] given the close one minute and then no time away, when the clock runs, then the countdown reaches the close and says the sales are closed", async () => {
    await kiosk(drawOf({ closesTick: 11 }));
    vi.setSystemTime(NEXT_TICK - time.MINUTE_MS - 1000);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(say("ui.lottery.closes-in", { wait: "1 minute" }))).toBeDefined();
    vi.setSystemTime(NEXT_TICK - 1000);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(say("ui.lottery.closed"))).toBeDefined();
  });

  test("[lottery:ticket-buying-capped] given a draw on sale, when two tickets are picked and bought, then lottery/buy goes with 2 and the kiosk shows them held and their price gone from the bank", async () => {
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

  test("[lottery:ticket-buying-capped] given tickets held, when more are picked, then the picker stops at the cap, and at the cap there is nothing to buy", async () => {
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

  test("[lottery:ticket-buying-capped] given a naira bank one kobo short of a ticket, when the kiosk is shown, then it says so and offers no purchase", async () => {
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

  test("[lottery:view-shows-draw-state] given the world's own row for the draw, when the fingerprint is opened, then the public round it will be drawn with is shown", async () => {
    const { store } = await kiosk(drawOf());
    act(() => store.setState({ world: { tick: 10, nextTickAt: NEXT_TICK, world: { ...onlineLife(drawOf()).game.world(), lottery: drawOf() } } }));
    expect(screen.getByText(say("ui.lottery.round", { round: formatNumber(1234) }))).toBeDefined();
  });
});

describe("the jackpot and the odds on the kiosk", () => {
  test("[lottery:screen-states-odds-plainly] [text:money-in-bank-words] given the rule page's odds, when the kiosk is shown, then the odds read in plain words with the jackpot standing, and nothing about a pot or a top-up", async () => {
    await kiosk(drawOf());
    const odds = document.querySelector<HTMLElement>("[data-lottery-odds]")!;
    expect(within(odds).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      say("ui.lottery.chance.jackpot", { every: formatNumber(5000), amount: money(20_000_000) }),
      say("ui.lottery.chance.mid", { every: formatNumber(2000), amount: money(5_000_000) }),
      say("ui.lottery.chance.small", { every: formatNumber(10), amount: money(50_000) }),
    ]);
    expect(odds.textContent).toContain("1 in 5,000 wins the jackpot of ₦200,000");
    // text:money-in-bank-words: the share the jackpot keeps is said in money, never a percentage.
    expect(screen.getByText(say("ui.lottery.grows", { kept: "₦10", each: "₦100", cap: money(tuning.odds.jackpotCap) }))).toBeDefined();
    expect(document.body.textContent).not.toContain("%");
    expect(document.body.textContent).not.toMatch(/\bpot\b|top.?up/i);
    expect(document.querySelector("[data-lottery-forced]")).toBeNull();
  });

  test("[lottery:screen-states-odds-plainly] given a jackpot that rolled over, one that starts again after a hit, and the first draw, when the kiosk is shown, then it says it rolled over, that it starts again, or nothing", async () => {
    const missed = drawnReply(6, 30, tuning.odds).result!;
    const rolled = await kiosk(drawOf({ jackpot: missed.nextJackpot, rolledOver: true, last: missed }));
    expect(document.querySelector("[data-lottery-jackpot]")?.textContent).toContain(money(missed.nextJackpot));
    expect(screen.getByText(say("ui.lottery.rolled"))).toBeDefined();
    rolled.life.live.lottery = drawOf({ jackpot: tuning.odds.jackpotStart, rolledOver: false, last: missed });
    await act(() => rolled.store.getState().refresh());
    expect(screen.getByText(say("ui.lottery.restarted"))).toBeDefined();
    rolled.life.live.lottery = drawOf();
    await act(() => rolled.store.getState().refresh());
    expect(screen.queryByText(say("ui.lottery.rolled"))).toBeNull();
    expect(screen.queryByText(say("ui.lottery.restarted"))).toBeNull();
  });

  test("[lottery:screen-states-odds-plainly] [lottery:jackpot-rolls-over] given odds a million does not divide and a forced win set, when the kiosk is shown, then the chance says about, and the forced win is said before sales close", async () => {
    await kiosk(drawOf({ odds: { ...tuning.odds, smallPerMillion: 300_000, forcedWinWeeks: 8 } }));
    expect(screen.getByText(say("ui.lottery.chance.small-about", { every: formatNumber(3), amount: money(50_000) }))).toBeDefined();
    expect(screen.getByText(say("ui.lottery.forced", { weeks: formatNumber(8) }))).toBeDefined();
  });

  test("[lottery:screen-states-odds-plainly] given the last draw hit or missed, when the kiosk is shown, then the last draw says whether the jackpot was hit and how many tickets won each prize", async () => {
    const hit = drawnReply(6, 60).result!;
    expect(hit.winners[0]!.tickets.length).toBeGreaterThan(0);
    await kiosk(drawOf({ last: hit }));
    const last = document.querySelector<HTMLElement>("[data-lottery-last]")!;
    expect(within(last).getByText(say("ui.lottery.last-line", { draw: 6, count: formatNumber(60) }))).toBeDefined();
    expect(within(last).getByText(say("ui.lottery.last-hit", { jackpot: money(hit.jackpot) }))).toBeDefined();
    for (const tier of hit.winners) {
      expect(last.querySelector(`[data-tier="${tier.tier}"]`)?.textContent).toContain(sayCount("ui.lottery.tier-line", tier.tickets.length, { tickets: tier.tickets.length, amount: money(tier.amount) }));
    }
  });

  test("[lottery:screen-states-odds-plainly] given the last draw's jackpot missed, when the kiosk is shown, then the last draw says it rolled over and to how much", async () => {
    const missed = drawnReply(6, 30, tuning.odds).result!;
    expect(missed.winners[0]!.tickets).toEqual([]);
    await kiosk(drawOf({ last: missed }));
    const last = document.querySelector<HTMLElement>("[data-lottery-last]")!;
    expect(within(last).getByText(say("ui.lottery.last-missed", { jackpot: money(missed.jackpot), next: money(missed.nextJackpot) }))).toBeDefined();
  });

  test("[lottery:draw-sells-between-ticks] given the draw on show closed and the next not yet open, when the kiosk is shown, then it says sales are closed until the result and offers no purchase", async () => {
    await kiosk(drawOf({ closesTick: 10 }));
    expect(screen.getByText(say("ui.lottery.closed-buy"))).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Buy/ })).toBeNull();
  });
});

describe("the win letter", () => {
  const letterOf = (prizes: { tier: "jackpot" | "mid" | "small"; amount: number }[]): ReportLine => {
    const life = onlineLife(drawOf());
    const paid = life.game.accept({ type: "lottery/pay", draw: 7, prizes }, "authority");
    return paid.lines.find((line) => line.key === "line.lottery.letter")!;
  };

  test("[lottery:winners-paid-by-authority] given a jackpot or a mid prize paid, when its letter reaches the screen, then it is staged as a moment of its own and marked as needing the player", async () => {
    for (const tier of ["jackpot", "mid"] as const) {
      const letter = letterOf([{ tier, amount: 1_320_000 }]);
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

  test("[lottery:winners-paid-by-authority] given only a small prize paid, when its letter reaches the screen, then it is not staged and still needs the player", async () => {
    const letter = letterOf([{ tier: "small", amount: 165_000 }]);
    expect(letter).toMatchObject({ big: false, attention: true });
    const authority = fakeAuthority(engineView());
    const store = createGameStore(authority);
    await store.getState().refresh();
    authority.linesNext([letter]);
    await store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
    expect(store.getState().moments).toEqual([]);
    expect(store.getState().lines).toEqual([letter]);
  });

  test("[lottery:winners-paid-by-authority] given a winner away when the draw paid, when the view is fetched again online, then the letter comes in the lines since the held version and is staged as a moment", async () => {
    const letter = letterOf([{ tier: "jackpot", amount: 1_320_000 }]);
    const server = fakeServer();
    const clock = { tick: 10, nextTickAt: NEXT_TICK, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) };
    server.answer("GET /api/view", { body: { ok: true, view: { ...engineView(), v: 4 }, lines: [], clock } }, { body: { ok: true, view: { ...engineView(), v: 6 }, lines: [letter], clock } });
    const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch });
    const store = createGameStore(remote);
    remote.listen((event) => store.getState().heard(event));
    await store.getState().refresh();
    expect(store.getState().moments).toEqual([]);
    await store.getState().refresh();
    expect(server.sent.at(-1)?.search).toBe("?since=4");
    expect(store.getState().moments).toEqual([letter]);
  });
});
