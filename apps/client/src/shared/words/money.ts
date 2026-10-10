// The month's money lines (docs/rules/world.md R-WORLD-008 and R-WORLD-019): every line in or out with its
// sign, one line for each payment as the report reads them. One source for the results sheet and the
// Bank's Lately, so the two never differ.
import { content } from "@japacity/content";
import type { Currency, MoneyParam, ReportLine } from "@japacity/sim";

import { afterPrologue, movesMoney, tidyLines } from "./lines";
import { moneyParam } from "./text";

export interface MoneyLine {
  line: ReportLine;
  /** In (1) or out (-1). */
  sign: 1 | -1;
  currency: Currency;
  amount: number;
}

/** Lines that carry an amount and a tone but move no money: a deposit flagged is a warning, not a flow. */
const NOT_MOVED: ReadonlySet<string> = new Set(["line.wallet.flagged"]);

export const CONVERTED = "line.wallet.converted";
export const CONVERT_PAID = "line.wallet.convert-paid";
export const BANK_CHARGE = "line.wallet.bank-charge";

/** A change at the bank as the results tell it: both sides in its words, and its net as the line's amount. */
export const CHANGED = "ui.results.changed";

/**
 * What a change at the bank took in, from its charge. The wallet's line for a change tells only what
 * came in; the charge just before it is R-WALLET-004's share of what was paid in, rounded down, so it
 * pins that to within one unit. A whole figure, as the Bank's chips send, is taken when one fits.
 */
function paidIn(charge: number): number {
  const share = content.tuning.wallet.bankChargeBp;
  const low = Math.ceil((charge * 10_000) / share);
  const high = Math.ceil(((charge + 1) * 10_000) / share) - 1;
  const whole = Math.ceil(low / 100) * 100;
  return whole <= high ? whole : Math.floor((low + high) / 2);
}

/** The side of a change that went out, as the results tell it: its own line in the money paid in. */
export const CHANGED_OUT = "ui.results.changed-out";

/**
 * A change of money at the bank, counted as the band moves in every money it touched (R-WALLET-004,
 * R-WORLD-008). The side that came in counts as money in, in
 * its own money; the side paid in counts as money out, in its own money, so Kept shows every currency
 * that moved and each matches its band. The bank's charge is folded into what was paid in and told in
 * the line's words, never counted again.
 */
function bankChange(line: ReportLine, charge: MoneyParam, paidLine: ReportLine | undefined): MoneyLine[] {
  const gained = moneyParam("amount", line.params, line.key);
  if (gained === null || gained.amount === 0) return [];
  // What was paid in: the wallet's own figure for the side changed plus the charge taken off it first; the charge alone
  // places it only to within a unit (the papers builder's finding), so that is the fallback for an older recording.
  const paidPart = paidLine === undefined ? null : moneyParam("amount", paidLine.params, paidLine.key);
  const paid = paidPart === null ? paidIn(charge.amount) : paidPart.amount + charge.amount;
  // The charge in the money it was taken in, as the confirm sheet names it.
  const told: ReportLine = { ...line, key: CHANGED, params: { ...line.params, paid: { currency: charge.currency, amount: paid }, got: gained, amount: { currency: charge.currency, amount: charge.amount } } };
  const out: ReportLine = { ...line, key: CHANGED_OUT, params: { amount: { currency: charge.currency, amount: paid } } };
  return [
    { line: told, sign: 1, currency: gained.currency, amount: gained.amount },
    { line: out, sign: -1, currency: charge.currency, amount: paid },
  ];
}

/** Money sent home: the wallet tells both legs as good; the leg in the money the character lives on is money out. */
const REMIT = "line.wallet.remit";

/**
 * The lines in or out, in the simulation's order, one line for each payment as the report reads
 * them. A good line with an amount is money in, a bad one money out; a change at the bank is one line
 * that counts only its net, in `local`, the money the character lives on (naira when not given); any
 * other plain line (a move between pockets) moves nothing the player keeps or loses. Only a line that
 * tells money moving counts: a bill that could not be paid, or a scam told after its fee, is not
 * money gone twice (R-WORLD-008).
 */
export function moneyLines(lines: readonly ReportLine[], local: Currency = "NGN"): MoneyLine[] {
  // The prologue's years are not this month: their money is what the character starts with.
  const tidy = tidyLines(afterPrologue(lines));
  return tidy.flatMap((line, index): MoneyLine[] => {
    const next = tidy[index + 1];
    if (line.key === BANK_CHARGE && (next?.key === CONVERTED || (next?.key === CONVERT_PAID && tidy[index + 2]?.key === CONVERTED))) return [];
    if (line.key === CONVERT_PAID) return [];
    if (line.key === CONVERTED) {
      // The bank's charge and the side paid in come just before what came in, in either order.
      const justBefore = tidy.slice(Math.max(0, index - 2), index);
      const chargeLine = justBefore.find((other) => other.key === BANK_CHARGE);
      const charge = chargeLine === undefined ? null : moneyParam("amount", chargeLine.params, chargeLine.key);
      const paidLine = justBefore.find((other) => other.key === CONVERT_PAID);
      if (charge !== null && charge.amount > 0 && charge.currency !== moneyParam("amount", line.params, line.key)?.currency) return bankChange(line, charge, paidLine);
      // With no bank's charge just before it (the street, a change that waited), only what came in is known.
      const gained = moneyParam("amount", line.params, line.key);
      return gained === null || gained.amount === 0 ? [] : [{ line, sign: 1, currency: gained.currency, amount: gained.amount }];
    }
    if (line.tone === "plain" || NOT_MOVED.has(line.key) || !movesMoney(line)) return [];
    const money = moneyParam("amount", line.params, line.key);
    if (money === null || money.amount === 0) return [];
    if (line.key === REMIT && money.currency === local) return [{ line, sign: -1, currency: money.currency, amount: money.amount }];
    return [{ line, sign: line.tone === "good" ? 1 : -1, currency: money.currency, amount: money.amount }];
  });
}
