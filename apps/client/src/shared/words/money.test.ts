// The money that changes hands, on the results and the Bank's Lately (docs/rules/world.md R-WORLD-008,
// R-WORLD-019; wallet.md R-WALLET-004, 006, 007, 015). Kept must move
// with the band, so the FX man's change cannot show only the pounds that came in. Every change shows both sides, each
// in its own money, and the figure kept is the simulation's own count: under decision 0021 a change counts for nothing
// in it either way, and only a bank's charge stays money out.
import { content } from "@japacity/content";
import type { Currency, FlatSave, ReportLine, World } from "@japacity/sim";
import { int, standInWorld } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { lifeSaves } from "../../../../../packages/sim/src/goldens/lives.data";
import { newLifeSaves } from "../../../../../packages/sim/src/sweep/lives.data";
import { start, type Game } from "../../../../../packages/sim/src/testing/play";
import { kept, localCurrency } from "../../features/turn/month.results";
import { newGame } from "../testing/fixtures";
import { formatMoney } from "./format";
import { changeLine } from "../../features/phone/apps/Bank";
import { moneyLines } from "./money";
import { newsLines } from "./told";
import { moneyParam, words } from "./text";

const SAVES: Record<string, FlatSave> = { ...lifeSaves, ...newLifeSaves };

/** What the results say of each money line, with its sign. */
function said(lines: readonly ReportLine[]): string[] {
  return moneyLines(lines).map(({ line, sign }) => `${sign > 0 ? "+" : "-"} ${words(line.key, line.params)}`);
}

/** Tunde with naira in hand as cash, as the FX man takes it. */
function withCash(naira: number): Game {
  const game = newGame("scenario.tunde");
  const moved = game.accept({ type: "wallet/move", currency: "NGN", amount: naira, to: "cash" });
  if (!moved.ok) throw new Error("The move to cash was refused.");
  return game;
}

/** The month's net so far, as the wallet holds it before the month closes (R-WALLET-015). */
function simNet(game: Game, currency: Currency): number {
  return game.state.wallet.monthNet?.[currency] ?? 0;
}

/** The stand-in world with the bank's queue up, as the news of a dollar squeeze sets it (R-WALLET-006). */
function queuedWorld(tick: number): World {
  const world = standInWorld("world-1", tick, content);
  return { ...world, vars: { ...world.vars, "var.fx-bank-queue": 2 } };
}

describe("the money that changes hands", () => {
  test("[R-WORLD-008] [R-WALLET-007] [R-WALLET-015] given naira changed into pounds with the FX man, when the month's money is read, then the pounds came in and the naira went out, each on its line in its own money, and what is kept counts the change for nothing, as the wallet's own count does", () => {
    const paid = 50_000_000;
    const game = withCash(paid);
    const before = game.view().pockets;
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: paid, via: "aboki" });
    const after = game.view().pockets;
    const got = after.GBP.cash - before.GBP.cash;
    expect(got).toBeGreaterThan(0);
    const money = moneyLines(told.lines);
    expect(money.map(({ sign, currency, amount }) => ({ sign, currency, amount }))).toEqual([
      { sign: 1, currency: "GBP", amount: got },
      { sign: -1, currency: "NGN", amount: paid },
    ]);
    // The change is told whole on its line: what went to the FX man and what came back.
    const change = words(money[0]!.line.key, money[0]!.line.params);
    expect(change).toContain(formatMoney(paid, "NGN"));
    expect(change).toContain(formatMoney(got, "GBP"));
    expect(words(money[1]!.line.key, money[1]!.line.params)).toContain(formatMoney(paid, "NGN"));
    // No short count was drawn, so the change moved nothing kept in either money.
    expect(told.lines.some((line) => line.key === "line.wallet.short-count")).toBe(false);
    const nets = kept(money);
    expect(nets).toEqual([]);
    // R-WALLET-015: the sheet's figure and the wallet's count of the month agree, in every money (a move to cash counts nothing).
    expect(nets.find((net) => net.currency === "NGN")?.amount ?? 0).toBe(simNet(game, "NGN"));
    expect(nets.find((net) => net.currency === "GBP")?.amount ?? 0).toBe(simNet(game, "GBP"));
    expect(game.state.wallet).not.toHaveProperty("monthNet");
  });

  test("[R-WORLD-008] [R-WALLET-007] given pounds changed back into naira with the FX man, when the month's money is read, then the naira came in and the pounds went out, each in its own money", () => {
    const game = withCash(50_000_000);
    game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 50_000_000, via: "aboki" });
    const pounds = game.view().pockets.GBP.cash;
    const nairaBefore = game.view().pockets.NGN.cash;
    const told = game.accept({ type: "wallet/convert", from: "GBP", to: "NGN", amount: pounds, via: "aboki" });
    const got = game.view().pockets.NGN.cash - nairaBefore;
    const money = moneyLines(told.lines);
    expect(money.map(({ sign, currency, amount }) => ({ sign, currency, amount }))).toEqual([
      { sign: 1, currency: "NGN", amount: got },
      { sign: -1, currency: "GBP", amount: pounds },
    ]);
    const change = words(money[0]!.line.key, money[0]!.line.params);
    expect(change).toContain(formatMoney(pounds, "GBP"));
    expect(change).toContain(formatMoney(got, "NGN"));
  });

  test("[R-WORLD-008] [R-WALLET-006] [R-WALLET-015] given naira paid in at the bank while its queue holds foreign money back, when each month's money is read, then the naira are told the month they leave and the pounds the month they land, and only the bank's charge counts, as gone the month it is taken, as the wallet counts it", () => {
    const game = start({ scenario: "scenario.tunde", content, worldAt: queuedWorld });
    const paid = 10_000_000;
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: paid, via: "bank" });
    expect(told.ok).toBe(true);
    expect(told.lines.some((line) => line.key === "line.wallet.queued")).toBe(true);
    const now = moneyLines(told.lines);
    // The charge and the side paid in: both told as naira out, nothing in yet; only the charge counts in what is kept.
    expect(now.every((entry) => entry.sign === -1 && entry.currency === "NGN")).toBe(true);
    const charge = Math.floor((paid * content.tuning.wallet.bankChargeBp) / 10_000);
    expect(kept(now)).toEqual([{ currency: "NGN", amount: -charge }]);
    expect(kept(now)[0]?.amount).toBe(simNet(game, "NGN"));
    expect(said(told.lines).join(" ")).toContain(formatMoney(paid - Math.floor((paid * content.tuning.wallet.bankChargeBp) / 10_000), "NGN"));
    // The pounds land in the settle phase of a later month's end, and count there.
    let landed: ReportLine[] = [];
    for (let month = 0; month < 4 && landed.length === 0; month += 1) {
      const ended = game.endTurn([]);
      if (ended.lines.some((line) => line.key === "line.wallet.converted")) landed = ended.lines;
    }
    const pounds = moneyLines(landed).filter((entry) => entry.currency === "GBP");
    expect(pounds).toHaveLength(1);
    expect(pounds[0]).toMatchObject({ sign: 1 });
    expect(game.view().pockets.GBP.bank).toBe(pounds[0]?.amount);
    // The pounds that landed are the change's other side: told, and kept as nothing.
    expect(kept(pounds)).toEqual([]);
  });

  test("[R-WORLD-008] [R-WALLET-015] given every recorded life, when each month closes, then the figure the results show as kept in the money of the place is the wallet's own net for that month, to the kobo", () => {
    for (const [name, save] of Object.entries(SAVES)) {
      const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
      let month: ReportLine[] = [];
      const differ: { month: number; sheet: number; wallet: number }[] = [];
      for (const { command, tick, sender } of save.commands) {
        game.tick = tick;
        const result = game.accept(command, sender);
        month.push(...result.lines);
        if (command.type !== "turn/end") continue;
        const closed = result.events.find((event) => event.type === "wallet/month-closed") as { net: number } | undefined;
        const view = game.view();
        const local = localCurrency(view);
        const sheet = kept(moneyLines(month)).find((entry) => entry.currency === local)?.amount ?? 0;
        if (closed !== undefined && sheet !== closed.net) differ.push({ month: view.month, sheet, wallet: closed.net });
        month = [];
      }
      expect({ name, differ }).toEqual({ name, differ: [] });
    }
  });

  test("[R-WORLD-008] [R-ACTIVITY-015] given one lotto ticket bought at the kiosk, then three, when the month's money is read, then each is told as lotto tickets, never as going out", () => {
    const game = newGame("scenario.tunde");
    const one = game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "1" });
    const ticket = content.tuning.luck.ticket;
    expect(said(one.lines)).toEqual([`- A lotto ticket: ${formatMoney(ticket, "NGN")}.`]);
    const three = game.accept({ type: "activity/now", activity: "activity.play-lotto", param: "3" });
    expect(said(three.lines)).toEqual([`- Lotto tickets: ${formatMoney(ticket * 3, "NGN")}.`]);
  });

  test("[R-WORLD-008] [R-WALLET-004] given pounds changed into naira at the bank for a charge that rounds to nothing, when the sheet before it and the month's money tell it, then no charge of £0 is said; a charge of a pound or more still is", () => {
    const game = newGame("scenario.tunde");
    game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 16_617_500, via: "bank" });
    const nothing = formatMoney(0, "GBP");
    // The confirm sheet before the change.
    expect(changeLine(game.view(), "GBP", "NGN", 2_200, "bank")).not.toContain(nothing);
    const small = game.accept({ type: "wallet/convert", from: "GBP", to: "NGN", amount: 2_200, via: "bank" });
    const charge = moneyParam("amount", small.lines.find((line) => line.key === "line.wallet.bank-charge")!.params, "line.wallet.bank-charge")!;
    expect(charge.amount).toBeGreaterThan(0);
    expect(formatMoney(charge.amount, "GBP")).toBe(nothing);
    const told = said(small.lines);
    expect(told.join(" ")).not.toContain(nothing);
    expect(told[0]).toContain(formatMoney(2_200, "GBP"));
    // News reads the same lines.
    expect(newsLines(small.lines, [], game.view()).map((line) => words(line.key, line.params)).join(" ")).not.toContain(nothing);
    // A charge that shows as a figure is still said, on the sheet and on the line.
    const bigCharge = formatMoney(int.bp(10_000_000, content.tuning.wallet.bankChargeBp), "NGN");
    expect(changeLine(game.view(), "NGN", "GBP", 10_000_000, "bank")).toContain(bigCharge);
    const big = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 10_000_000, via: "bank" });
    // Said once, on its own line.
    expect(said(big.lines).filter((line) => line.includes(bigCharge))).toHaveLength(1);
  });
});
