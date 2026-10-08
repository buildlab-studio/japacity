import { content } from "@japacity/content";
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
  odds: content.tuning.lottery.odds,
  jackpot: 24_000_000,
  winners: [
    { tier: "jackpot", tickets: [17], amount: 24_000_000 },
    { tier: "mid", tickets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], amount: 5_000_000 },
    { tier: "small", tickets: [20, 21, 22, 23, 24, 25], amount: 50_000 },
  ],
  nextJackpot: 20_000_000,
};

function online(last: LotteryResult | null): PlayerView {
  const view = engineView("scenario.tunde");
  return {
    ...view,
    lottery: {
      ticket: 20_000,
      maxTickets: 5,
      draw: 7,
      closesTick: 112,
      tickets: 0,
      numbers: null,
      jackpot: 20_000_000,
      rolledOver: false,
      odds: content.tuning.lottery.odds,
      fingerprint: "ab".repeat(32),
      last,
    },
  };
}

describe("the draw on the front page", () => {
  test("[R-LOTTERY-016] given a drawn draw whose jackpot was hit, when the news is read, then the front page gives the jackpot it stood at, that it was hit, and how many tickets won, and no ticket number or code", async () => {
    await renderWithView(<NewsView />, online(RESULT));
    const line = document.querySelector<HTMLElement>("[data-news-drawn]")!;
    expect(line.textContent).toContain(say("ui.news.drawn", { draw: 6, jackpot: formatMoney(24_000_000, "NGN"), winners: 17 }));
    expect(line.textContent).not.toMatch(/1, 2, 3/);
    expect(line.textContent).not.toContain(RESULT.listHash);
  });

  test("[R-LOTTERY-016] given a draw whose jackpot nobody hit, or one with no ticket sold, when the news is read, then the line says it rolls over, or that nobody won", () => {
    const missed: LotteryResult = { ...RESULT, winners: [{ tier: "jackpot", tickets: [], amount: 24_000_000 }, ...RESULT.winners.slice(1)], nextJackpot: 24_600_000 };
    expect(drawnWords(missed)).toBe(say("ui.news.drawn-rolled", { draw: 6, jackpot: formatMoney(24_000_000, "NGN"), winners: 16 }));
    const empty: LotteryResult = { ...RESULT, count: 0, winners: RESULT.winners.map((tier) => ({ ...tier, tickets: [] })) };
    expect(drawnWords(empty)).toBe(say("ui.news.drawn-none", { draw: 6 }));
  });

  test("[R-LOTTERY-016] given no draw drawn yet or the game offline, when the news is read, then there is no draw line", async () => {
    await renderWithView(<NewsView />, online(null));
    expect(document.querySelector("[data-news-drawn]")).toBeNull();
    expect(screen.getByText(say("ui.news.title"))).toBeDefined();
  });
});
