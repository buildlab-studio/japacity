// The ledger report: docs/rules/wallet.md R-WALLET-013. Played lives come from
// the goldens; a doctored state is a played one with one total raised by hand,
// as a tampered account would arrive.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp, divCeil } from "../engine/int";
import type { Currency, Reason, State } from "../engine/types";
import { lifeSaves } from "../goldens/lives.data";
import { replay } from "../engine/replay";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { ledgerReport } from "./report";

function played(name: string): State {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`The goldens have no ${name}.`);
  return replay(save, content, (tick) => standInWorld(save.worldSeed, tick, content)).state;
}

/** Tunde's life at home, three months in. */
function tunde(): State {
  const game = start({ content, scenario: "scenario.tunde" });
  for (let month = 0; month < 3; month += 1) game.endTurn();
  return game.state;
}

/** The state with the total in under `reason` set to `amount` in `currency`. */
function doctored(state: State, reason: Reason, currency: Currency, amount: number): State {
  const totals = state.wallet.totals;
  return { ...state, wallet: { ...state.wallet, totals: { ...totals, in: { ...totals.in, [reason]: { ...totals.in[reason], [currency]: amount } } } } };
}

/** The ceiling the report holds a reason to, read from the alarm a far larger total raises. */
function ceilingOf(state: State, reason: Reason, currency: Currency): number {
  const alarm = ledgerReport(doctored(state, reason, currency, Number.MAX_SAFE_INTEGER), content).alarms.find((found) => found.reason === reason && found.currency === currency);
  if (alarm === undefined) throw new Error(`No alarm for ${reason} in ${currency}.`);
  return alarm.ceiling;
}

describe("the ledger report", () => {
  test.each(Object.keys(lifeSaves))("[R-WALLET-013] given the golden %s played to its end, when the report is made, then it shows money made and spent by reason and currency, transfers left out, and names nothing as suspect", (name) => {
    const state = played(name);
    const report = ledgerReport(state, content);
    expect(report.alarms).toEqual([]);
    expect(report.suspect).toBe(false);
    expect(report.months).toBe(state.turn.month);
    expect(report.created.convert).toBeUndefined();
    expect(report.created.move).toBeUndefined();
    expect(report.destroyed.convert).toBeUndefined();
    expect(report.created.salary).toEqual(state.wallet.totals.in.salary);
    expect(report.created.opening).toEqual(state.wallet.totals.in.opening);
    expect(report.destroyed.upkeep).toEqual(state.wallet.totals.out.upkeep);
  });

  test("[R-WALLET-013] given months played at home, when the salary ceiling in naira is read, then it is the best naira job's month with overtime in every free slot, times the months; at it nothing is suspect and one kobo over names the account", () => {
    const state = tunde();
    const months = state.turn.month;
    expect(months).toBe(3);
    let best = 0;
    for (const entry of Object.values(content.activity)) {
      const amount = entry.pay?.amount;
      if (entry.slot !== "main" || entry.cash === true || entry.pay?.currency !== "NGN" || typeof amount !== "number") continue;
      const bonus = entry.carBonus ?? 0;
      best = Math.max(best, entry.where === "abroad" ? divCeil(amount + bonus, 12) : amount + divCeil(bonus, 12));
    }
    const { turn, ladder } = content.tuning;
    const ceiling = months * (best + turn.freeSlots * bp(best, ladder.overtimeBp));
    expect(ceilingOf(state, "salary", "NGN")).toBe(ceiling);
    expect(ledgerReport(doctored(state, "salary", "NGN", ceiling), content).suspect).toBe(false);
    const over = ledgerReport(doctored(state, "salary", "NGN", ceiling + 1), content);
    expect(over.alarms).toEqual([{ reason: "salary", currency: "NGN", total: ceiling + 1, ceiling }]);
    expect(over.suspect).toBe(true);
  });

  test("[R-WALLET-013] given the opening money, when it is read, then the ceiling is the richest starting life's; at it nothing is suspect and one kobo over names the account", () => {
    const state = tunde();
    const richest = Math.max(...Object.values(content.scenario).map((life) => (life.pockets.NGN?.bank ?? 0) + (life.pockets.NGN?.cash ?? 0)));
    expect(ceilingOf(state, "opening", "NGN")).toBe(richest);
    expect(ledgerReport(doctored(state, "opening", "NGN", richest), content).alarms).toEqual([]);
    expect(ledgerReport(doctored(state, "opening", "NGN", richest + 1), content).alarms).toEqual([{ reason: "opening", currency: "NGN", total: richest + 1, ceiling: richest }]);
  });

  test("[R-WALLET-013] given pot-top-up retired by decision 0010, when the report is made, then its ceiling is 0: none credited is clean and one kobo names the account", () => {
    const state = tunde();
    expect(ceilingOf(state, "pot-top-up", "NGN")).toBe(0);
    expect(ledgerReport(doctored(state, "pot-top-up", "NGN", 0), content).alarms).toEqual([]);
    expect(ledgerReport(doctored(state, "pot-top-up", "NGN", 1), content).alarms).toEqual([{ reason: "pot-top-up", currency: "NGN", total: 1, ceiling: 0 }]);
  });

  test.each([
    ["salary", "GBP"],
    ["cash-work", "GBP"],
    ["gig", "NGN"],
    ["salary", "USD"],
  ] as const)("[R-WALLET-013] given a played life whose %s total in %s is doctored, when the report is made, then at the ceiling nothing is suspect and one unit over trips the alarm for that reason alone", (reason, currency) => {
    const state = played("ada-careful");
    const ceiling = ceilingOf(state, reason, currency);
    expect(ceiling).toBeGreaterThan(0);
    expect(ledgerReport(doctored(state, reason, currency, ceiling), content).alarms).toEqual([]);
    const over = ledgerReport(doctored(state, reason, currency, ceiling + 1), content);
    expect(over.alarms).toEqual([{ reason, currency, total: ceiling + 1, ceiling }]);
    expect(over.suspect).toBe(true);
  });
});
