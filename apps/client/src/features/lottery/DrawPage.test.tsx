import type { ServerRejection } from "@japacity/api";
import type { LotteryResult } from "@japacity/sim";
import { drawResults, drawSeed, ticketResult, toHex } from "@japacity/sim";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import "../../shared/testing/render";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { checkDraw, serverDrawLoader, type DrawReply, type LoadDraw } from "./draw";
import { DrawPage } from "./DrawPage";
import { LotteryView } from "./LotteryView";
import { drawnReply, drawOf, GENEROUS, onlineLife, tuning } from "./lottery.testing";

function loader(reply: DrawReply | ServerRejection): LoadDraw & { asked: number[] } {
  const asked: number[] = [];
  return Object.assign((draw: number) => {
    asked.push(draw);
    return Promise.resolve(reply);
  }, { asked });
}

async function page(reply: DrawReply | ServerRejection, draw = 6): Promise<void> {
  render(<DrawPage draw={draw} load={loader(reply)} />);
  await act(() => Promise.resolve());
}

function verdict(mark: string): { good: boolean; text: string } {
  const found = document.querySelector<HTMLElement>(`[data-check="${mark}"]`);
  if (found === null) throw new Error(`No ${mark} check on the page.`);
  return { good: found.dataset.good === "true", text: found.textContent };
}

/** A published result with one winning ticket moved, as a server that lied would publish it. */
function tampered(result: LotteryResult): LotteryResult {
  const [jackpot, ...rest] = result.winners;
  const moved = ((jackpot!.tickets[0] ?? 0) + 1) % result.count;
  return { ...result, winners: [{ ...jackpot!, tickets: [moved] }, ...rest] };
}

describe("the draw page", () => {
  test("[R-LOTTERY-015] [R-LOTTERY-023] given a drawn draw, when its page is read, then the seed and every ticket are worked out on the device with drawSeed and ticketResult, a plain line says they match, and the odds and next jackpot are shown", async () => {
    const reply = drawnReply(6, 60);
    const result = reply.result!;
    const check = checkDraw(reply)!;
    const seed = drawSeed(result.revealed, result.listHash, result.beaconRandomness);
    expect(check.seed).toBe(toHex(seed));
    expect(check.tickets).toEqual(Array.from({ length: 60 }, (_, number) => ticketResult(seed, number, GENEROUS)));
    expect(check.winners).toEqual(drawResults(seed, 60, GENEROUS, GENEROUS.jackpotStart));
    await page(reply);
    expect(verdict("winners")).toEqual({ good: true, text: say("ui.lottery.page.check.winners") });
    expect(verdict("fingerprint")).toEqual({ good: true, text: say("ui.lottery.page.check.fingerprint") });
    expect(verdict("list")).toEqual({ good: true, text: say("ui.lottery.page.check.list") });
    expect(screen.getByText(check.seed)).toBeDefined();
    expect(screen.getByText(reply.listHash!)).toBeDefined();
    expect(screen.getByText(result.revealed)).toBeDefined();
    expect(screen.getByText(say("ui.lottery.page.next", { next: formatMoney(result.nextJackpot, "NGN") }))).toBeDefined();
    expect(document.querySelector("[data-lottery-odds]")?.textContent).toContain(say("ui.lottery.chance.jackpot", { every: formatNumber(20), amount: formatMoney(GENEROUS.jackpotStart, "NGN") }));
  });

  test("[R-LOTTERY-015] given a result whose prize amounts were raised, or a forced jackpot where the odds name none, when the page is read, then it says they do not match; with a forced win named, the forced ticket matches", () => {
    const reply = drawnReply(6, 60);
    const result = reply.result!;
    const raised = { ...result, winners: result.winners.map((tier) => (tier.tier === "small" ? { ...tier, amount: tier.amount + 1 } : tier)) };
    expect(checkDraw({ ...reply, result: raised })).toMatchObject({ matches: false });

    const quiet = drawnReply(6, 20, tuning.odds);
    const seed = drawSeed(quiet.result!.revealed, quiet.result!.listHash, quiet.result!.beaconRandomness);
    const forced = drawResults(seed, 20, tuning.odds, tuning.odds.jackpotStart, true);
    expect(forced).not.toEqual(quiet.result!.winners);
    expect(checkDraw({ ...quiet, result: { ...quiet.result!, winners: forced } })).toMatchObject({ matches: false });
    const named = { ...tuning.odds, forcedWinWeeks: 4 };
    expect(checkDraw({ ...quiet, odds: named, result: { ...quiet.result!, odds: named, winners: forced } })).toMatchObject({ matches: true });
  });

  test("[R-LOTTERY-015] given a result whose winners were moved, a secret that is not the fingerprint's, or a list that is not its hash, when the page is read, then each line says it does not match", async () => {
    const reply = drawnReply(6, 60);
    await page({ ...reply, result: tampered(reply.result!) });
    expect(verdict("winners")).toEqual({ good: false, text: say("ui.lottery.page.check.winners-bad") });

    const secret = drawnReply(7, 60).result!.revealed;
    expect(checkDraw({ ...reply, result: { ...reply.result!, revealed: secret } })).toMatchObject({ fingerprint: false, matches: false });
    expect(checkDraw({ ...reply, list: [...reply.list!].reverse() })).toMatchObject({ list: false, matches: true });
    expect(checkDraw({ ...reply, list: reply.list!.slice(1) })).toMatchObject({ list: false });
  });

  test("[R-LOTTERY-015] given the list, when it is shown, then each ticket is a code and its number, never a name, beside what the phone worked out it won", async () => {
    const reply = drawnReply(6, 12);
    await page(reply);
    fireEvent.click(screen.getByRole("button", { name: say("ui.lottery.page.show-list") }));
    const list = document.querySelector<HTMLElement>("[data-draw-list]")!;
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(12);
    expect(list.textContent).toContain(reply.list![0]);
    const check = checkDraw(reply)!;
    expect(items.map((item) => item.dataset.ticketTier)).toEqual(check.tickets.map((tier) => tier ?? ""));
    expect(check.tickets.some((tier) => tier !== null)).toBe(true);
  });

  test("[R-LOTTERY-015] given a draw on sale or one frozen with no result yet, when its page is read, then it shows what is published so far and says what comes next", async () => {
    const drawn = drawnReply(6, 10);
    await page({ ...drawn, list: null, count: null, listHash: null, result: null });
    expect(screen.getByText(say("ui.lottery.page.open"))).toBeDefined();
    expect(screen.getByText(drawn.fingerprint)).toBeDefined();
    expect(document.querySelector("[data-draw-checks]")).toBeNull();
  });

  test("[R-LOTTERY-015] given the list published and the result not yet, when the page is read, then it says the result waits for the public round", async () => {
    const drawn = drawnReply(6, 10);
    await page({ ...drawn, result: null });
    expect(screen.getByText(say("ui.lottery.page.waiting"))).toBeDefined();
    expect(screen.getByText(formatNumber(10))).toBeDefined();
  });

  test("[R-LOTTERY-015] given a refusal from the server, when the page is read, then it says the draw could not be fetched", async () => {
    await page({ ok: false, code: "not-legal", detail: "There is no draw 6." });
    expect(screen.getByText(say("ui.lottery.page.failed"))).toBeDefined();
  });

  test("[R-LOTTERY-023] given a draw on sale, when its page is read, then it shows the odds and the jackpot it opened with, and nothing about a pot or a top-up", async () => {
    const drawn = drawnReply(6, 10, tuning.odds, 25_000_000);
    await page({ ...drawn, list: null, count: null, listHash: null, result: null });
    expect(document.querySelector("[data-lottery-odds]")?.textContent).toContain(say("ui.lottery.chance.jackpot", { every: formatNumber(5000), amount: formatMoney(25_000_000, "NGN") }));
    expect(document.body.textContent).not.toMatch(/\bpot\b|top.?up/i);
  });

  test("[R-LOTTERY-015] given the kiosk with a last draw, when it is checked, then the draw page opens for that draw and fetches it", async () => {
    const reply = drawnReply(6, 60);
    const life = onlineLife(drawOf({ last: reply.result }));
    const store = createGameStore(life.authority);
    await store.getState().refresh();
    const load = loader(reply);
    render(
      <GameProvider store={store}>
        <LotteryView load={load} />
      </GameProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: say("ui.lottery.check", { draw: 6 }) }));
    await act(() => Promise.resolve());
    expect(load.asked).toEqual([6]);
    expect(await screen.findByRole("dialog", { name: say("ui.lottery.page.title", { draw: 6 }) })).toBeDefined();
    expect(verdict("winners").good).toBe(true);
  });

  test("[R-LOTTERY-015] given the local authority, when the kiosk is built, then there is no server to fetch a draw from", () => {
    expect(serverDrawLoader()).toBeNull();
  });
});
