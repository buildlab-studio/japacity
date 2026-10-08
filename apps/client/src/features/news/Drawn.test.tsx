import type { LotteryResult, PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { drawnWords, NewsView } from "./NewsView";

const RESULT: LotteryResult = {
  draw: 6,
  revealed: "cd".repeat(32),
  beaconRound: 1006,
  beaconRandomness: "ef".repeat(32),
  listHash: "01".repeat(32),
  count: 300,
  pot: 6_000_000,
  topUp: 0,
  fund: 3_300_000,
  winners: [
    { tier: "jackpot", tickets: [17], amount: 1_320_000 },
    { tier: "mid", tickets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], amount: 99_000 },
    { tier: "small", tickets: [20, 21, 22, 23, 24, 25], amount: 165_000 },
  ],
};

function online(last: LotteryResult | null): PlayerView {
  const view = engineView("scenario.tunde");
  return {
    ...view,
    lottery: { ticket: 20_000, maxTickets: 5, draw: 7, closesTick: 112, tickets: 0, numbers: null, potSoFar: 0, topUpTickets: 0, topUpSoFar: 0, fingerprint: "ab".repeat(32), last },
  };
}

describe("the draw on the front page", () => {
  test("[R-LOTTERY-016] given a drawn draw, when the news is read, then the front page gives the jackpot and how many tickets won, and no ticket number or code", async () => {
    await renderWithView(<NewsView />, online(RESULT));
    const line = document.querySelector<HTMLElement>("[data-news-drawn]")!;
    expect(line.textContent).toContain(say("ui.news.drawn", { draw: 6, jackpot: formatMoney(1_320_000, "NGN"), winners: 17 }));
    expect(line.textContent).not.toMatch(/1, 2, 3/);
    expect(line.textContent).not.toContain(RESULT.listHash);
  });

  test("[R-LOTTERY-016] given a draw whose jackpot no ticket filled, or one with no ticket sold, when the news is read, then the line says so", () => {
    const noJackpot: LotteryResult = { ...RESULT, winners: [{ tier: "jackpot", tickets: [], amount: 1_320_000 }, ...RESULT.winners.slice(1)] };
    expect(drawnWords(noJackpot)).toBe(say("ui.news.drawn-no-jackpot", { draw: 6, winners: 16 }));
    const empty: LotteryResult = { ...RESULT, count: 0, winners: RESULT.winners.map((tier) => ({ ...tier, tickets: [] })) };
    expect(drawnWords(empty)).toBe(say("ui.news.drawn-none", { draw: 6 }));
    const one: LotteryResult = { ...RESULT, winners: [RESULT.winners[0]!, { ...RESULT.winners[1]!, tickets: [] }, { ...RESULT.winners[2]!, tickets: [] }] };
    expect(drawnWords(one)).toBe(say("ui.news.drawn.one", { draw: 6, jackpot: formatMoney(1_320_000, "NGN") }));
  });

  test("[R-LOTTERY-016] given no draw drawn yet or the game offline, when the news is read, then there is no draw line", async () => {
    await renderWithView(<NewsView />, online(null));
    expect(document.querySelector("[data-news-drawn]")).toBeNull();
    expect(screen.getByText(say("ui.news.title"))).toBeDefined();
  });
});
