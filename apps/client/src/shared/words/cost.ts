// What a payment needs from the pockets now, for "why not" and for figures
// shown before the player commits. The engine still decides; these figures
// only say which number is short. A foreign fee is paid from that currency's
// pockets first and the rest is bought from the naira bank at the bank rate,
// plus the bank's charge (docs/rules/wallet.md, R-WALLET-009).
import { content } from "@japacity/content";
import { int, type Currency, type ForeignCurrency, type MoneyParam, type PlayerView, type SlotPick } from "@japacity/sim";

export type Money = { currency: Currency; amount: number };
type Pockets = Pick<PlayerView, "pockets" | "rates">;

/** A foreign amount in naira at the bank rate, before any charge. */
export function atBankRate(view: Pockets, currency: Currency, amount: number): number {
  return currency === "NGN" ? amount : int.mulDiv(amount, view.rates[currency].official, 100);
}

/** The naira a foreign fee would take from the naira bank now, with the bank's charge. */
export function nairaForFee(view: Pockets, currency: Currency, amount: number): number {
  if (currency === "NGN") return amount;
  const pocket = view.pockets[currency];
  const rest = Math.max(0, amount - pocket.bank - pocket.cash);
  if (rest === 0) return 0;
  const naira = int.mulDivCeil(rest, view.rates[currency].official, 100);
  return naira + int.bp(naira, content.tuning.wallet.bankChargeBp);
}

export interface Shortfall {
  /** True when any part is in a foreign currency, so it is bought from the naira bank. */
  foreign: boolean;
  /** Naira the costs need: from bank and cash for naira costs, from the bank for the foreign part. */
  need: number;
  /** Naira there is to pay it with. */
  have: number;
  /** How much is missing, or zero. */
  short: number;
}

/** What a set of costs needs in naira now, against what there is. */
export function shortfall(view: Pockets, costs: readonly Money[]): Shortfall {
  const byCurrency = new Map<Currency, number>();
  for (const cost of costs) byCurrency.set(cost.currency, (byCurrency.get(cost.currency) ?? 0) + cost.amount);
  const naira = view.pockets.NGN;
  const local = byCurrency.get("NGN") ?? 0;
  let bought = 0;
  for (const [currency, amount] of byCurrency) if (currency !== "NGN") bought += nairaForFee(view, currency, amount);
  const foreign = [...byCurrency.keys()].some((currency) => currency !== "NGN");
  // Naira costs can use cash; the bank buys foreign currency only from the bank pocket.
  const have = foreign ? naira.bank : naira.bank + naira.cash;
  const need = local + bought;
  return { foreign, need, have, short: Math.max(0, need - have) };
}

/** What the month's plan will already pay for when it ends, as the view prices each pick. */
export function plannedCosts(view: Pick<PlayerView, "activities">, plan: readonly (SlotPick | null)[]): Money[] {
  return plan.flatMap((pick) => (pick === null ? [] : (view.activities.find((option) => option.id === pick.activity)?.cost ?? [])));
}

/**
 * What is left once a cost is paid, or how much is short: never both. `due` is what falls due at
 * the month's end in the same currency, when what is left (and the month's pay) will not meet it.
 */
export type AfterPaying = { left: Money; short: null; due: Money | null } | { left: null; short: Money };

/** What the view says of pay: the jobs held and the offers open (docs/rules/wallet.md R-WALLET-016). */
export type PayView = Pick<PlayerView, "job" | "offers">;

/**
 * A job's pay a month as the wallet will book it, net of tax, from the view (R-WALLET-016): the job held, the side
 * job, or the job an open offer names. Null when the view carries no figure for it.
 */
export function monthlyPayOf(view: PayView, job: string): MoneyParam | null {
  if (view.job.id === job) return view.job.pay;
  if (view.job.side === job) return view.job.sidePay;
  return view.offers.find((offer) => offer.terms["job"] === job && offer.pay !== undefined)?.pay ?? null;
}

/** The month's dues against the pay that comes in before them (docs/rules/engine.md section 4: the job pays, then the bills are taken). */
export interface MonthDues {
  due: Money[];
  pay: Money[];
}

/** What the month's end takes, by currency, and the jobs' pay that arrives first. */
export function monthDues(view: Pick<PlayerView, "obligations" | "job">): MonthDues {
  const sum = (moneys: Money[]): Money[] => {
    const totals = new Map<Currency, number>();
    for (const { currency, amount } of moneys) totals.set(currency, (totals.get(currency) ?? 0) + amount);
    return [...totals].map(([currency, amount]) => ({ currency, amount }));
  };
  const due = view.obligations.flatMap((owed): Money[] => {
    const currency = content.obligation[owed.entry]?.currency;
    return currency === undefined || owed.due <= 0 ? [] : [{ currency, amount: owed.due }];
  });
  const pay = [view.job.pay, view.job.sidePay].flatMap((monthly): Money[] => (monthly === null ? [] : [monthly]));
  return { due: sum(due), pay: sum(pay) };
}

/** The dues in `left`'s currency when what is left and the month's pay will not meet them, else null. */
function dueOver(left: Money, dues: MonthDues | null): Money | null {
  if (dues === null) return null;
  const due = dues.due.find((each) => each.currency === left.currency)?.amount ?? 0;
  const pay = dues.pay.find((each) => each.currency === left.currency)?.amount ?? 0;
  return due > 0 && left.amount + pay < due ? { currency: left.currency, amount: due } : null;
}

/**
 * What paying these costs leaves, after what the month already plans, or how much is short, so
 * a main button can say what is left after and stay shut when it cannot be paid (R-WORLD-006).
 * A cost in one foreign currency held in its own pockets is told in that currency; anything that
 * needs naira is told in naira, as `shortfall` counts it. With `dues`, what is left is held against
 * what the month's end takes, so the card can warn before a bill goes unpaid.
 */
export function afterPaying(view: Pockets, planned: readonly Money[], costs: readonly Money[], dues: MonthDues | null = null): AfterPaying {
  const all = [...planned, ...costs];
  const currencies = new Set(costs.map((cost) => cost.currency));
  const [only] = currencies;
  if (currencies.size === 1 && only !== undefined && only !== "NGN") {
    const pocket = view.pockets[only];
    const need = all.filter((cost) => cost.currency === only).reduce((sum, cost) => sum + cost.amount, 0);
    if (pocket.bank + pocket.cash >= need) {
      const left = { currency: only, amount: pocket.bank + pocket.cash - need };
      return { left, short: null, due: dueOver(left, dues) };
    }
  }
  const gap = shortfall(view, all);
  if (gap.short > 0) return { left: null, short: { currency: "NGN", amount: gap.short } };
  const left: Money = { currency: "NGN", amount: gap.have - gap.need };
  return { left, short: null, due: dueOver(left, dues) };
}

/** The same for money the caller has counted itself (a bill paid now from held funds): one figure in the cost's currency. */
export function afterHaving(have: number, cost: Money): AfterPaying {
  return have >= cost.amount ? { left: { currency: cost.currency, amount: have - cost.amount }, short: null, due: null } : { left: null, short: { currency: cost.currency, amount: cost.amount - have } };
}

/**
 * What a change of money gives, worked as the wallet works it (R-WALLET-004, R-WALLET-007), so the
 * Change money card can say "You get £8,436" before it is confirmed. At the
 * bank: the charge comes off what is paid in and the rest goes at the official rate. With the FX man:
 * the street rate, less his spread on a sale; his count can still come up short. The engine decides.
 */
export function changeQuote(view: Pick<PlayerView, "rates">, from: Currency, to: Currency, amount: number, via: "bank" | "aboki"): { got: Money; charge: Money } {
  const rates = (which: "official" | "street") => Object.fromEntries(Object.entries(view.rates).map(([currency, rate]) => [currency, rate[which]])) as Record<ForeignCurrency, number>;
  if (via === "bank") {
    const charge = int.bp(amount, content.tuning.wallet.bankChargeBp);
    return { got: { currency: to, amount: int.convertMinor(amount - charge, from, to, rates("official")) }, charge: { currency: from, amount: charge } };
  }
  const street = rates("street");
  const sell = from === "NGN" ? 0 : street[from] - int.bp(street[from], content.tuning.wallet.streetSpreadBp);
  const naira = from === "NGN" ? amount : int.mulDiv(amount, sell, 100);
  return { got: { currency: to, amount: to === "NGN" ? naira : int.convertMinor(naira, "NGN", to, street) }, charge: { currency: from, amount: 0 } };
}
