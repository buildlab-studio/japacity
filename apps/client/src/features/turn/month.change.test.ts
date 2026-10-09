// A change of money on the results (docs/rules/world.md R-WORLD-008, wallet.md R-WALLET-004; the
// in Ada's second month abroad the dollars she changed into pounds were not on the
// results, only the bank's charge, and the pounds read as all spent. The change is one line: what
// went out of the one money, with what came into the other in its words, and both count in what was kept.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { recordedGame } from "../../shared/testing/fixtures";
import { formatMoney } from "../../shared/words/format";
import { words } from "../../shared/words/text";
import { kept, moneyLines } from "./month.results";

const CHARGE = content.tuning.wallet.bankChargeBp;

/** Ada landed in London, a change made at the bank, then the month ended: the lines the results read. */
function changedAbroad(amount: (dollars: number) => number): { lines: ReportLine[]; paid: number; charge: number; received: number } {
  const game = recordedGame("ada-careful");
  const paid = amount(game.view().pockets.USD.bank);
  const poundsBefore = game.view().pockets.GBP.bank;
  const told = game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: paid, via: "bank" }).lines;
  const received = game.view().pockets.GBP.bank - poundsBefore;
  const ended = game.endTurn([]);
  const report = game.view().report?.lines ?? ended.lines;
  return { lines: [...told, ...report], paid, charge: Math.floor((paid * CHARGE) / 10000), received };
}

describe("a change of money on the results", () => {
  test("[R-WORLD-008] [R-WALLET-004] given a quarter of Ada's dollars changed into pounds at the bank, when the month's money is read, then the change is one line, the dollars out beside the pounds in, with the bank's charge on its own", () => {
    const { lines, paid, charge, received } = changedAbroad((dollars) => Math.floor(dollars / 4 / 100) * 100);
    const money = moneyLines(lines);
    const changes = money.filter((entry) => entry.line.key === "line.wallet.converted");
    expect(changes).toHaveLength(1);
    const change = changes[0];
    expect(change).toMatchObject({ sign: -1, currency: "USD", amount: paid - charge, gained: { currency: "GBP", amount: received } });
    expect(words(change?.line.key ?? "", change?.line.params ?? {})).toContain(formatMoney(received, "GBP"));
    expect(money.find((entry) => entry.line.key === "line.wallet.bank-charge")).toMatchObject({ sign: -1, currency: "USD", amount: charge });
  });

  test("[R-WORLD-008] [R-WALLET-004] given the change, when what was kept is counted, then the pounds count what came in and the dollars all that went out, the charge with it", () => {
    const { lines, paid, received } = changedAbroad((dollars) => Math.floor(dollars / 4 / 100) * 100);
    const money = moneyLines(lines);
    const spentInPounds = money.filter((entry) => entry.currency === "GBP").reduce((sum, entry) => sum + entry.sign * entry.amount, 0);
    const nets = kept(money);
    expect(nets.find((net) => net.currency === "USD")?.amount).toBe(-paid);
    expect(nets.find((net) => net.currency === "GBP")?.amount).toBe(spentInPounds + received);
  });

  test("[R-WORLD-008] [R-WALLET-004] given all the dollars changed, a figure no chip rounds, when the change is read, then what went out shows as the whole dollars it was", () => {
    const { lines, paid, charge } = changedAbroad((dollars) => dollars);
    const change = moneyLines(lines).find((entry) => entry.line.key === "line.wallet.converted");
    expect(change?.currency).toBe("USD");
    expect(formatMoney(change?.amount ?? 0, "USD")).toBe(formatMoney(paid - charge, "USD"));
    expect(Math.abs((change?.amount ?? 0) - (paid - charge))).toBeLessThan(50);
  });

  test("[R-WORLD-008] given a change with no bank's charge before it, when the month's money is read, then what came in still shows, as money in", () => {
    const line: ReportLine = { key: "line.wallet.converted", params: { amount: { currency: "GBP", amount: 50_000 } }, tone: "plain", attention: false, counts: [] };
    expect(moneyLines([line])).toEqual([{ line, sign: 1, currency: "GBP", amount: 50_000 }]);
    expect(kept(moneyLines([line]))).toEqual([{ currency: "GBP", amount: 50_000 }]);
  });
});
