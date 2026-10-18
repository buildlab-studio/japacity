// The month's dues abroad against the country's money held (docs/rules/world.md R-WORLD-003,
// 019). The obligation kind takes a foreign charge from that currency's own pockets
// and never through the naira, so a month whose dues pass the pounds held goes unpaid however much
// naira and how many dollars wait. The Bank and the nudge both read it.
import { content } from "@japacity/content";
import { CURRENCIES, type Currency, type PlayerView } from "@japacity/sim";

import { localCurrency } from "./wayHome";

export interface DuesGap {
  /** The country's money. */
  currency: Currency;
  /** What the month's end will charge in it. */
  due: number;
  /** Bank and cash held in it now. */
  held: number;
  /** The other money held, the way to close the gap. */
  from: Currency[];
}

/** The other money held in bank or cash, the naira first, then the rest in the wallet's order. */
export function heldElsewhere(view: Pick<PlayerView, "pockets">, local: Currency): Currency[] {
  return CURRENCIES.filter((currency) => currency !== local && view.pockets[currency].bank + view.pockets[currency].cash > 0);
}

/**
 * Abroad, the month's dues in the country's money when they are more than that money held; null at
 * home, and abroad when what is held covers them. Read from the view at any moment, so it shows on
 * landing, at the start of a month and until the gap is closed.
 */
export function duesGap(view: Pick<PlayerView, "place" | "pockets" | "obligations"> & Partial<Pick<PlayerView, "job">>): DuesGap | null {
  const currency = localCurrency(view);
  if (currency === "NGN") return null;
  const due = view.obligations.reduce((sum, owed) => (owed.due > 0 && content.obligation[owed.entry]?.currency === currency ? sum + owed.due : sum), 0);
  const held = view.pockets[currency].bank + view.pockets[currency].cash;
  // The month's pay comes in before the bills are taken (engine.md section 4): it covers them too.
  const pay = view.job?.pay ?? null;
  const coming = pay !== null && pay.currency === currency ? pay.amount : 0;
  if (due <= held + coming) return null;
  return { currency, due, held, from: heldElsewhere(view, currency) };
}
