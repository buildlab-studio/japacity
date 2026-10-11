// The month's money lines (docs/rules/world.md R-WORLD-008 and R-WORLD-019): every line in or out with its
// sign, one line for each payment as the report reads them. One source for the results sheet and the
// Bank's Lately, so the two never differ.
import { content } from "@japacity/content";
import type { Currency, MoneyParam, ReportLine } from "@japacity/sim";

import { formatMoney } from "./format";
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

/** A change at the bank as the results tell it: both sides in its words, its charge told on its own line after it. */
export const CHANGED = "ui.results.changed";
/** The same, for a charge too small to show as a figure: it gets no line, no "The bank's charge: £0". */
export const CHANGED_SMALL = "ui.results.changed-small";

/** True when a charge shows as a figure; one that rounds to nothing ("£0") is not said at all. */
export function chargeShown(amount: number, currency: Currency): boolean {
  return formatMoney(amount, currency) !== formatMoney(0, currency);
}

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
/** The bank's charge on a change, its own line as money out, in the results' words. */
export const CHANGE_CHARGE = "ui.results.change-charge";

/**
 * A change of money at the bank, counted as the band moves in every money it touched (R-WALLET-004,
 * R-WORLD-008). The side that came in counts as money in, in
 * its own money; the side paid in counts as money out, in its own money, so Kept shows every currency
 * that moved and each matches its band. The bank's charge is told once, on its own line as money out, and the change's
 * paid side is what went at the rate, the charge not in it. A charge too small to show as a figure gets no line of its own ("£0"): it rides on the
 * change's line and Kept still counts it, as the wallet does (R-WALLET-015).
 */
function bankChange(line: ReportLine, chargeLine: ReportLine, charge: MoneyParam, paidLine: ReportLine | undefined): MoneyLine[] {
  const gained = moneyParam("amount", line.params, line.key);
  if (gained === null || gained.amount === 0) return [];
  // What went at the rate: the wallet's own figure for the side changed, after the charge was taken off it; the charge
  // alone places what was paid in only to within a unit (the papers builder's finding), the fallback for an older recording.
  const paidPart = paidLine === undefined ? null : moneyParam("amount", paidLine.params, paidLine.key);
  const paid = paidPart === null ? paidIn(charge.amount) - charge.amount : paidPart.amount;
  const shown = chargeShown(charge.amount, charge.currency);
  // The charge in the money it was taken in, as the confirm sheet names it.
  const told: ReportLine = { ...line, key: shown ? CHANGED : CHANGED_SMALL, params: { ...line.params, paid: { currency: charge.currency, amount: paid }, got: gained, amount: { currency: charge.currency, amount: charge.amount } } };
  const out: ReportLine = { ...line, key: CHANGED_OUT, params: { amount: { currency: charge.currency, amount: paid } } };
  return [
    { line: told, sign: 1, currency: gained.currency, amount: gained.amount },
    { line: out, sign: -1, currency: charge.currency, amount: paid },
    ...(shown ? [{ line: { ...chargeLine, key: CHANGE_CHARGE, params: { amount: charge } }, sign: -1 as const, currency: charge.currency, amount: charge.amount }] : []),
  ];
}

/** The side of a change with the FX man, as the results tell it: both sides in its words, what came in as its amount. */
export const CHANGED_STREET = "ui.results.changed-street";
/** What went to the FX man, its own line in the money paid in. */
export const CHANGED_STREET_OUT = "ui.results.changed-street-out";
/** Naira paid in at the bank while its queue holds the foreign money back: gone now, the other side counted when it lands. */
export const CHANGED_QUEUED = "ui.results.changed-queued";
const QUEUED = "line.wallet.queued";

/**
 * A change with the FX man (R-WALLET-007): no charge, the side paid in just before what came in. Both
 * count, each in its own money, as the wallet counts them (R-WORLD-008, R-WALLET-015).
 */
function streetChange(line: ReportLine, paidLine: ReportLine): MoneyLine[] {
  const gained = moneyParam("amount", line.params, line.key);
  const paid = moneyParam("amount", paidLine.params, paidLine.key);
  if (gained === null || paid === null || gained.amount === 0) return [];
  const told: ReportLine = { ...line, key: CHANGED_STREET, params: { ...line.params, paid, got: gained } };
  const out: ReportLine = { ...paidLine, key: CHANGED_STREET_OUT, params: { amount: paid } };
  return [
    { line: told, sign: 1, currency: gained.currency, amount: gained.amount },
    { line: out, sign: -1, currency: paid.currency, amount: paid.amount },
  ];
}

/** A side paid in that no change on the same lines took up: a purchase the bank's queue holds, or one told alone. */
function paidAlone(line: ReportLine, next: ReportLine | undefined): MoneyLine[] {
  const paid = moneyParam("amount", line.params, line.key);
  if (paid === null || paid.amount === 0) return [];
  const queued = next?.key === QUEUED ? next : undefined;
  const told: ReportLine =
    queued === undefined
      ? { ...line, key: CHANGED_OUT, params: { amount: paid } }
      : { ...line, key: CHANGED_QUEUED, params: { amount: paid, currency: queued.params.currency ?? "", readyMonth: queued.params.readyMonth ?? 0 } };
  return [{ line: told, sign: -1, currency: paid.currency, amount: paid.amount }];
}

/** How each change on the month's lines is told: the lines it takes up, by the index of what came in. */
interface Change {
  charge: number | null;
  paid: number | null;
}

function changesOf(tidy: readonly ReportLine[]): { found: Map<number, Change>; taken: Set<number> } {
  const found = new Map<number, Change>();
  const taken = new Set<number>();
  tidy.forEach((line, index) => {
    if (line.key !== CONVERTED) return;
    // The bank's charge and the side paid in come just before what came in, in either order; the FX man's side paid in comes right before it.
    const window = [index - 2, index - 1].filter((at) => at >= 0 && !taken.has(at));
    const charge = window.find((at) => tidy[at]?.key === BANK_CHARGE) ?? null;
    const gained = moneyParam("amount", line.params, line.key);
    const chargeMoney = charge === null ? null : moneyParam("amount", tidy[charge]!.params, BANK_CHARGE);
    if (charge !== null && chargeMoney !== null && chargeMoney.amount > 0 && chargeMoney.currency !== gained?.currency) {
      const paid = window.find((at) => tidy[at]?.key === CONVERT_PAID) ?? null;
      found.set(index, { charge, paid });
      taken.add(charge);
      if (paid !== null) taken.add(paid);
      return;
    }
    const paid = index > 0 && !taken.has(index - 1) && tidy[index - 1]?.key === CONVERT_PAID ? index - 1 : null;
    found.set(index, { charge: null, paid });
    if (paid !== null) taken.add(paid);
  });
  return { found, taken };
}

/** The kiosk's tickets, said as the activity's money (lines.ts) and as many tickets when more than one. */
export const LOTTO_PAID = "ui.line.activity-paid.activity.play-lotto";
export const LOTTO_TICKETS = "ui.results.lotto-tickets";

/**
 * Each of the month's lines (already tidied) as the money tells it: the money lines it stands for, none when another
 * line's telling took it up or it moved nothing to tell (a charge of nothing), or null when it is no money line at all
 * and is told as itself. A good line with an amount is money in, a bad one money out; a change counts both sides,
 * each in its own money (R-WORLD-008), at the bank or with the FX man, and a side paid in while the bank's queue
 * holds the other back counts the month it leaves. Any other plain line (a move between pockets) moves nothing the
 * player keeps or loses. Only a line that tells money moving counts: a bill that could not be paid, or a scam told
 * after its fee, is not money gone twice. News reads this to tell the month in the results' words (the eleventh
 * review).
 */
export function moneyTold(tidy: readonly ReportLine[]): (MoneyLine[] | null)[] {
  const { found, taken } = changesOf(tidy);
  return tidy.map((line, index): MoneyLine[] | null => {
    if (taken.has(index)) return [];
    const change = found.get(index);
    if (change !== undefined) {
      const chargeLine = change.charge === null ? undefined : tidy[change.charge];
      const paidLine = change.paid === null ? undefined : tidy[change.paid];
      const charge = chargeLine === undefined ? null : moneyParam("amount", chargeLine.params, chargeLine.key);
      if (chargeLine !== undefined && charge !== null) return bankChange(line, chargeLine, charge, paidLine);
      if (paidLine !== undefined) return streetChange(line, paidLine);
      // With nothing paid in on the same lines (a change that waited in the bank's queue), only what came in is here.
      const gained = moneyParam("amount", line.params, line.key);
      return gained === null || gained.amount === 0 ? [] : [{ line, sign: 1, currency: gained.currency, amount: gained.amount }];
    }
    if (line.key === CONVERT_PAID) return paidAlone(line, tidy[index + 1]);
    if (line.tone === "plain" || NOT_MOVED.has(line.key) || !movesMoney(line)) return null;
    const money = moneyParam("amount", line.params, line.key);
    if (money === null) return null;
    if (money.amount === 0) return [];
    const told = line.key === LOTTO_PAID && money.amount > content.tuning.luck.ticket ? { ...line, key: LOTTO_TICKETS } : line;
    return [{ line: told, sign: line.tone === "good" ? 1 : -1, currency: money.currency, amount: money.amount }];
  });
}

/**
 * The lines in or out, in the simulation's order, one line for each payment as the report reads them (`moneyTold`).
 * In or out is the line's tone, which the wallet takes from the money moving (docs/rules/wallet.md R-WALLET-017).
 */
export function moneyLines(lines: readonly ReportLine[]): MoneyLine[] {
  // The prologue's years are not this month: their money is what the character starts with.
  return moneyTold(tidyLines(afterPrologue(lines))).flatMap((told) => told ?? []);
}
