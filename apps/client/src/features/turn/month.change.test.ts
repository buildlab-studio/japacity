// A change of money on the results (docs/rules/world.md R-WORLD-008, wallet.md R-WALLET-004; the
// fourth and fifth reviews): in Ada's second month abroad the dollars she changed into pounds were not
// on the results, only the bank's charge; then, once both sides counted, the pounds that came in read
// as money kept. The
// change is one line with both sides in its words, and it counts once, as its net in the money the
// character lives on: the dollars out at the bank's rate, less the pounds in.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, recordedGame } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { CHANGED, kept, moneyLines } from "./month.results";

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
  test("[R-WORLD-008] [R-WALLET-004] given a quarter of Ada's dollars changed into pounds at the bank, when the month's money is read, then the change is one line in pounds that says both sides, with the bank's charge folded in", () => {
    const { lines, paid, charge, received } = changedAbroad((dollars) => Math.floor(dollars / 4 / 100) * 100);
    const money = moneyLines(lines, "GBP");
    const changes = money.filter((entry) => entry.line.key === CHANGED);
    expect(changes).toHaveLength(1);
    const change = changes[0];
    const net = Math.round((charge * received) / (paid - charge));
    expect(change).toMatchObject({ sign: -1, currency: "GBP", amount: net });
    const said = words(change?.line.key ?? "", change?.line.params ?? {});
    expect(said).toContain(formatMoney(paid, "USD"));
    expect(said).toContain(formatMoney(received, "GBP"));
    expect(said).toContain(formatMoney(net, "GBP"));
    expect(money.some((entry) => entry.line.key === "line.wallet.bank-charge" || entry.line.key === "line.wallet.converted")).toBe(false);
  });

  test("[R-WORLD-008] [R-WALLET-004] given the change, when what was kept is counted, then no dollars show, and the pounds kept are the band's move from the change to the month's end less the change's net, never the pounds that came in", () => {
    const { lines, paid, charge, received, band } = changedAbroad((dollars) => Math.floor(dollars / 4 / 100) * 100);
    const nets = kept(moneyLines(lines, "GBP"));
    expect(nets.find((net) => net.currency === "USD")).toBeUndefined();
    expect(nets.find((net) => net.currency === "GBP")?.amount).toBe(band.ended - band.changed - Math.round((charge * received) / (paid - charge)));
  });

  test("[R-WORLD-008] [R-WALLET-004] given all the dollars changed, a figure no chip rounds, when the change is read, then what went out shows as the whole dollars it was", () => {
    const { lines, paid } = changedAbroad((dollars) => dollars);
    const change = moneyLines(lines, "GBP").find((entry) => entry.line.key === CHANGED);
    const out = change?.line.params["paid"];
    if (typeof out !== "object") throw new Error("The change does not say what went out.");
    expect(out.currency).toBe("USD");
    expect(formatMoney(out.amount, "USD")).toBe(formatMoney(paid, "USD"));
    expect(Math.abs(out.amount - paid)).toBeLessThan(50);
  });

  test("[R-WORLD-008] given a change with no bank's charge before it, when the month's money is read, then what came in still shows, as money in", () => {
    const line: ReportLine = { key: "line.wallet.converted", params: { amount: { currency: "GBP", amount: 50_000 } }, tone: "plain", attention: false, counts: [] };
    expect(moneyLines([line])).toEqual([{ line, sign: 1, currency: "GBP", amount: 50_000 }]);
    expect(kept(moneyLines([line]))).toEqual([{ currency: "GBP", amount: 50_000 }]);
  });

  test("[R-WORLD-008] [R-WALLET-004] given naira changed into pounds at the bank at home, when what was kept is counted, then the naira count only the bank's charge and no pounds show as kept", () => {
    const game = newGame("scenario.tunde");
    const naira = (): number => game.view().pockets.NGN.bank + game.view().pockets.NGN.cash;
    const before = naira();
    const paid = 10_000_000;
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: paid, via: "bank" }).lines;
    const charge = Math.floor((paid * CHARGE) / 10000);
    const changed = naira();
    expect(before - changed).toBe(paid);
    const money = moneyLines(told, "NGN");
    expect(money).toHaveLength(1);
    expect(money[0]).toMatchObject({ sign: -1, currency: "NGN", amount: charge });
    expect(kept(money)).toEqual([{ currency: "NGN", amount: -charge }]);
  });
});
