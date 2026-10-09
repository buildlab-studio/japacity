// What the money abroad asks of the player (docs/rules/world.md R-WORLD-019):
// the month's dues in the country's money against what is held of it. The obligation kind takes a
// foreign charge from that currency's own pockets and never through the naira, so a month whose dues
// pass the pounds held goes unpaid however much naira and how many dollars wait. The Bank says so
// first, with the way: change money into the country's own.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";

import { CURRENCIES } from "../../../shared/words/format";
import { lowerFirst, say } from "../../../shared/words/text";
import { localCurrency } from "../../../shared/words/wayHome";
import { phoneWords } from "../phone.words";

/** The Bank's words abroad, first drafts in the voice of docs/rules/text.md; content's and the phone's tables win. */
const ABROAD_TEXT: Record<string, string> = {
  "phone.bank.dues": "Due this month: {due}. You hold {held}.",
  "phone.bank.dues.way": "Change money: {from} to {to}",
  "phone.bank.held": "Also held",
};

export function abroadWords(key: string, params: Record<string, string> = {}): string {
  const said = phoneWords(key, params);
  if (said !== key) return said;
  return (ABROAD_TEXT[key] ?? key).replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => params[name] ?? whole);
}

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
export function duesGap(view: Pick<PlayerView, "place" | "pockets" | "obligations">): DuesGap | null {
  const currency = localCurrency(view);
  if (currency === null || currency === "NGN") return null;
  const due = view.obligations.reduce((sum, owed) => (owed.due > 0 && content.obligation[owed.entry]?.currency === currency ? sum + owed.due : sum), 0);
  const held = view.pockets[currency].bank + view.pockets[currency].cash;
  if (due <= held) return null;
  return { currency, due, held, from: heldElsewhere(view, currency) };
}

/** The money to change first: a foreign currency before the naira, whose purchase at the bank may wait in its queue (R-WALLET-006). */
export function changeFirst(from: readonly Currency[]): Currency | null {
  return from.find((currency) => currency !== "NGN") ?? from[0] ?? null;
}

/** "naira or dollars": the currencies by their names, in the order given. */
export function currencyList(currencies: readonly Currency[]): string {
  return currencies.map((currency) => lowerFirst(say(`ui.currency.${currency}`))).join(" or ");
}
