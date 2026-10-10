// The money that changes hands, on the results and the Bank's Lately (docs/rules/world.md R-WORLD-008,
// R-WORLD-019; wallet.md R-WALLET-004, 006, 007, 015). "Kept this month +₦91,000 / +£54"
// while the band fell by ₦1,228,031, because the FX man's change showed only the pounds that came in. Every
// change shows both sides, each in its own money, and the figure kept is the simulation's own count.
import { content } from "@japacity/content";
import type { Currency, FlatSave, ReportLine, World } from "@japacity/sim";
import { standInWorld } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { lifeSaves } from "../../../../../packages/sim/src/goldens/lives.data";
import { newLifeSaves } from "../../../../../packages/sim/src/sweep/lives.data";
import { start, type Game } from "../../../../../packages/sim/src/testing/play";
import { kept, localCurrency } from "../../features/turn/month.results";
import { newGame } from "../testing/fixtures";
import { formatMoney } from "./format";
import { moneyLines } from "./money";
import { words } from "./text";

const SAVES: Record<string, FlatSave> = { ...lifeSaves, ...newLifeSaves };

/** What the results say of each money line, with its sign. */
function said(lines: readonly ReportLine[], local: Currency = "NGN"): string[] {
  return moneyLines(lines, local).map(({ line, sign }) => `${sign > 0 ? "+" : "-"} ${words(line.key, line.params)}`);
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
  test("[R-WORLD-008] [R-WALLET-007] given naira changed into pounds with the FX man, when the month's money is read, then the pounds came in and the naira went out, each on its line in its own money, and what is kept in each is the wallet's own count", () => {
    const paid = 50_000_000;
    const game = withCash(paid);
    const before = game.view().pockets;
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: paid, via: "aboki" });
    const after = game.view().pockets;
    const got = after.GBP.cash - before.GBP.cash;
    expect(got).toBeGreaterThan(0);
    const money = moneyLines(told.lines, "NGN");
    expect(money.map(({ sign, currency, amount }) => ({ sign, currency, amount }))).toEqual([
      { sign: 1, currency: "GBP", amount: got },
      { sign: -1, currency: "NGN", amount: paid },
    ]);
    // The change is told whole on its line: what went to the FX man and what came back.
    const change = words(money[0]!.line.key, money[0]!.line.params);
    expect(change).toContain(formatMoney(paid, "NGN"));
    expect(change).toContain(formatMoney(got, "GBP"));
    expect(words(money[1]!.line.key, money[1]!.line.params)).toContain(formatMoney(paid, "NGN"));
    const nets = kept(money);
    expect(nets).toEqual([
      { currency: "GBP", amount: got },
      { currency: "NGN", amount: -paid },
    ]);
    // R-WALLET-015: the sheet's figure and the wallet's count of the month agree, in every money (a move to cash counts nothing).
    expect(nets.find((net) => net.currency === "NGN")?.amount).toBe(simNet(game, "NGN"));
    expect(nets.find((net) => net.currency === "GBP")?.amount).toBe(simNet(game, "GBP"));
  });

  test("[R-WORLD-008] [R-WALLET-007] given pounds changed back into naira with the FX man, when the month's money is read, then the naira came in and the pounds went out, each in its own money", () => {
    const game = withCash(50_000_000);
    game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 50_000_000, via: "aboki" });
    const pounds = game.view().pockets.GBP.cash;
    const nairaBefore = game.view().pockets.NGN.cash;
    const told = game.accept({ type: "wallet/convert", from: "GBP", to: "NGN", amount: pounds, via: "aboki" });
    const got = game.view().pockets.NGN.cash - nairaBefore;
    const money = moneyLines(told.lines, "NGN");
    expect(money.map(({ sign, currency, amount }) => ({ sign, currency, amount }))).toEqual([
      { sign: 1, currency: "NGN", amount: got },
      { sign: -1, currency: "GBP", amount: pounds },
    ]);
    const change = words(money[0]!.line.key, money[0]!.line.params);
    expect(change).toContain(formatMoney(pounds, "GBP"));
    expect(change).toContain(formatMoney(got, "NGN"));
  });

  test("[R-WORLD-008] [R-WALLET-006] given naira paid in at the bank while its queue holds foreign money back, when each month's money is read, then the naira count as gone the month they leave and the pounds as come the month they land, as the wallet counts them", () => {
    const game = start({ scenario: "scenario.tunde", content, worldAt: queuedWorld });
    const paid = 10_000_000;
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: paid, via: "bank" });
    expect(told.ok).toBe(true);
    expect(told.lines.some((line) => line.key === "line.wallet.queued")).toBe(true);
    const now = moneyLines(told.lines, "NGN");
    // The charge and the side paid in: all of it naira out, nothing in yet.
    expect(now.every((entry) => entry.sign === -1 && entry.currency === "NGN")).toBe(true);
    expect(kept(now)).toEqual([{ currency: "NGN", amount: -paid }]);
    expect(kept(now)[0]?.amount).toBe(simNet(game, "NGN"));
    expect(said(told.lines).join(" ")).toContain(formatMoney(paid - Math.floor((paid * content.tuning.wallet.bankChargeBp) / 10_000), "NGN"));
    // The pounds land in the settle phase of a later month's end, and count there.
    let landed: ReportLine[] = [];
    for (let month = 0; month < 4 && landed.length === 0; month += 1) {
      const ended = game.endTurn([]);
      if (ended.lines.some((line) => line.key === "line.wallet.converted")) landed = ended.lines;
    }
    const pounds = moneyLines(landed, "NGN").filter((entry) => entry.currency === "GBP");
    expect(pounds).toHaveLength(1);
    expect(pounds[0]).toMatchObject({ sign: 1 });
    expect(game.view().pockets.GBP.bank).toBe(pounds[0]?.amount);
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
        const sheet = kept(moneyLines(month, local)).find((entry) => entry.currency === local)?.amount ?? 0;
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
});

