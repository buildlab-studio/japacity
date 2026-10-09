// What a payment needs from the pockets now, for "why not" and for figures
// shown before the player commits. The engine still decides; these figures
// only say which number is short. A foreign fee is paid from that currency's
// pockets first and the rest is bought from the naira bank at the bank rate,
// plus the bank's charge (docs/rules/wallet.md, R-WALLET-009).
import { content } from "@japacity/content";
import { int, type Currency, type PlayerView, type SlotPick } from "@japacity/sim";

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

/** What is left once a cost is paid, or how much is short: never both. */
export type AfterPaying = { left: Money; short: null } | { left: null; short: Money };

/**
 * What paying these costs leaves, after what the month already plans, or how much is short, so
 * a main button can say what is left after and stay shut when it cannot be paid (R-WORLD-006).
 * A cost in one foreign currency held in its own pockets is told in that currency; anything that
 * needs naira is told in naira, as `shortfall` counts it.
 */
export function afterPaying(view: Pockets, planned: readonly Money[], costs: readonly Money[]): AfterPaying {
  const all = [...planned, ...costs];
  const currencies = new Set(costs.map((cost) => cost.currency));
  const [only] = currencies;
  if (currencies.size === 1 && only !== undefined && only !== "NGN") {
    const pocket = view.pockets[only];
    const need = all.filter((cost) => cost.currency === only).reduce((sum, cost) => sum + cost.amount, 0);
    if (pocket.bank + pocket.cash >= need) return { left: { currency: only, amount: pocket.bank + pocket.cash - need }, short: null };
  }
  const gap = shortfall(view, all);
  return gap.short > 0 ? { left: null, short: { currency: "NGN", amount: gap.short } } : { left: { currency: "NGN", amount: gap.have - gap.need }, short: null };
}

/** The same for money the caller has counted itself (a bill paid now from held funds): one figure in the cost's currency. */
export function afterHaving(have: number, cost: Money): AfterPaying {
  return have >= cost.amount ? { left: { currency: cost.currency, amount: have - cost.amount }, short: null } : { left: null, short: { currency: cost.currency, amount: cost.amount - have } };
}
