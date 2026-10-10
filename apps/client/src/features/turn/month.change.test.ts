// A change of money on the results (docs/rules/world.md R-WORLD-008, wallet.md R-WALLET-004; the
// fourth and fifth reviews): in Ada's second month abroad the dollars she changed into pounds were not
// on the results, only the bank's charge; then, once both sides counted, the pounds that came in read
// as money kept. The
// change is one line with both sides in its words. Since decision 0021 as amended a change
// counts for nothing in what was kept, either way: changing money is a move, not spending, and only the
// bank's charge stays money out, as the wallet counts the month (R-WALLET-015).
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, recordedGame } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { CHANGED, CHANGED_OUT, kept, moneyLines } from "./month.results";

const CHARGE = content.tuning.wallet.bankChargeBp;

/** Ada landed in London, a change made at the bank, then the month ended: the lines the results read. */
function changedAbroad(amount: (dollars: number) => number): { lines: ReportLine[]; paid: number; charge: number; received: number; band: { changed: number; ended: number } } {
  const game = recordedGame("ada-careful");
  const pounds = (): number => game.view().pockets.GBP.bank + game.view().pockets.GBP.cash;
  const paid = amount(game.view().pockets.USD.bank);
  const poundsBefore = game.view().pockets.GBP.bank;
  const told = game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: paid, via: "bank" }).lines;
  const received = game.view().pockets.GBP.bank - poundsBefore;
  const changed = pounds();
  const ended = game.endTurn([]);
  const report = game.view().report?.lines ?? ended.lines;
  return { lines: [...told, ...report], paid, charge: Math.floor((paid * CHARGE) / 10000), received, band: { changed, ended: pounds() } };
}

describe("a change of money on the results", () => {
  test("[R-WORLD-008] [R-WALLET-004] given a quarter of Ada's dollars changed into pounds at the bank, when the month's money is read, then the change is one line that says both sides with the bank's charge folded in, counted as the pounds that came in", () => {
    const { lines, paid, charge, received } = changedAbroad((dollars) => Math.floor(dollars / 4 / 100) * 100);
    const money = moneyLines(lines);
    const changes = money.filter((entry) => entry.line.key === CHANGED);
    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change).toMatchObject({ sign: 1, currency: "GBP", amount: received });
    const said = words(change?.line.key ?? "", change?.line.params ?? {});
    expect(said).toContain(formatMoney(paid, "USD"));
    expect(said).toContain(formatMoney(received, "GBP"));
    // The charge in the money it was taken in, as the confirm sheet says it.
    expect(said).toContain(formatMoney(charge, "USD"));
    expect(money.some((entry) => entry.line.key === "line.wallet.bank-charge" || entry.line.key === "line.wallet.converted")).toBe(false);
  });

  test("[R-WORLD-008] [R-WALLET-004] [R-WALLET-015] given the change, when what was kept is counted, then the pounds kept are the band's move over the month after the change, the pounds that came in not counted, and only the bank's charge shows as gone from the dollars", () => {
    const { lines, paid, charge, band } = changedAbroad((dollars) => Math.floor(dollars / 4 / 100) * 100);
    const nets = kept(moneyLines(lines));
    expect(nets.find((net) => net.currency === "USD")?.amount).toBe(-charge);
    expect(nets.find((net) => net.currency === "GBP")?.amount ?? 0).toBe(band.ended - band.changed);
    const out = moneyLines(lines).find((entry) => entry.line.key === CHANGED_OUT);
    expect(words(out?.line.key ?? "", out?.line.params)).toContain(formatMoney(paid, "USD"));
  });

  test("[R-WORLD-008] [R-WALLET-004] given all the dollars changed, a figure no chip rounds, when the change is read, then what went out shows as the whole dollars it was", () => {
    const { lines, paid } = changedAbroad((dollars) => dollars);
    const change = moneyLines(lines).find((entry) => entry.line.key === CHANGED);
    const out = change?.line.params["paid"];
    if (typeof out !== "object") throw new Error("The change does not say what went out.");
    expect(out.currency).toBe("USD");
    expect(formatMoney(out.amount, "USD")).toBe(formatMoney(paid, "USD"));
    expect(Math.abs(out.amount - paid)).toBeLessThan(50);
  });

  test("[R-WORLD-008] given a change with no bank's charge before it, when the month's money is read, then what came in still shows, as money in, and counts for nothing in what was kept", () => {
    const line: ReportLine = { key: "line.wallet.converted", params: { amount: { currency: "GBP", amount: 50_000 } }, tone: "plain", attention: false, counts: [] };
    expect(moneyLines([line])).toEqual([{ line, sign: 1, currency: "GBP", amount: 50_000 }]);
    expect(kept(moneyLines([line]))).toEqual([]);
  });

  test("[R-WORLD-008] [R-WALLET-004] [R-WALLET-015] given naira changed into pounds at the bank at home, when what was kept is counted, then the naira count only the bank's charge as gone, and the pounds that came in are told on their own line and kept as nothing", () => {
    const game = newGame("scenario.tunde");
    const naira = (): number => game.view().pockets.NGN.bank + game.view().pockets.NGN.cash;
    const before = naira();
    const paid = 10_000_000;
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: paid, via: "bank" }).lines;
    const charge = Math.floor((paid * CHARGE) / 10000);
    const changed = naira();
    expect(before - changed).toBe(paid);
    const money = moneyLines(told);
    expect(money).toHaveLength(2);
    expect(money[1]).toMatchObject({ sign: -1, currency: "NGN", amount: paid });
    // The pounds that came in are told on the change's own line, and kept as nothing.
    expect(money[0]).toMatchObject({ sign: 1, currency: "GBP" });
    expect(kept(money)).toEqual([{ currency: "NGN", amount: -charge }]);
    expect(words(money[0]?.line.key ?? "", money[0]?.line.params)).toContain(formatMoney(charge, "NGN"));
  });

  test("[R-WALLET-015] [R-WORLD-008] given a month abroad with a change at the bank, and a month at home with one, when each month closes, then the results' kept figure in the money of the place is the net the wallet counts the month by", () => {
    const abroad = recordedGame("ada-careful");
    const local = (game: ReturnType<typeof newGame>): "GBP" | "NGN" => (game.state.place.where === "abroad" ? "GBP" : "NGN");
    const home = newGame("scenario.tunde");
    for (const [game, change] of [
      [abroad, { type: "wallet/convert", from: "USD", to: "GBP", amount: Math.floor(abroad.view().pockets.USD.bank / 4 / 100) * 100, via: "bank" }],
      [home, { type: "wallet/convert", from: "NGN", to: "GBP", amount: 10_000_000, via: "bank" }],
    ] as const) {
      const told = game.accept(change).lines;
      expect(told.some((line) => line.key === "line.wallet.converted")).toBe(true);
      const ended = game.endTurn([]);
      const closed = ended.events.find((event) => event.type === "wallet/month-closed") as { currency: string; net: number } | undefined;
      const lines = [...told, ...(game.view().report?.lines ?? ended.lines)];
      const sheet = kept(moneyLines(lines)).find((net) => net.currency === local(game))?.amount ?? 0;
      expect(closed?.currency).toBe(local(game));
      expect(sheet).toBe(closed?.net);
    }
  });

  test("[R-WORLD-008] [R-ABROAD-006] given pounds sent home by app, when the month's money is read, then the pounds count as money out and the naira as landed at home, never both as sent", () => {
    const game = recordedGame("ada-careful");
    const pounds = game.view().pockets.GBP.bank;
    const sent = Math.floor(pounds / 2 / 100) * 100;
    const nairaBefore = game.view().pockets.NGN.bank;
    const told = game.accept({ type: "wallet/remit", currency: "GBP", amount: sent, channel: "app" }).lines;
    const landed = game.view().pockets.NGN.bank - nairaBefore;
    expect(landed).toBeGreaterThan(0);
    const money = moneyLines(told);
    expect(money.find((entry) => entry.currency === "GBP")).toMatchObject({ sign: -1, amount: sent });
    const naira = money.find((entry) => entry.currency === "NGN");
    expect(naira).toMatchObject({ sign: 1, amount: landed });
    expect(words(naira?.line.key ?? "", naira?.line.params)).toBe(`Landed in your naira account at home: ${formatMoney(landed, "NGN")}.`);
    expect(kept(money)).toEqual([
      { currency: "GBP", amount: -sent },
      { currency: "NGN", amount: landed },
    ]);
  });
});
