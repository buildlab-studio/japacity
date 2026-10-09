// What the Bank says abroad when the month's dues pass the country's money held (docs/rules/world.md
// R-WORLD-019): the gap, then the way, change money into the country's own.
// The gap itself is read in shared/words/dues.ts, which the nudge reads too.
import type { Currency } from "@japacity/sim";

import { lowerFirst, say } from "../../../shared/words/text";
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

/** The money to change first: a foreign currency before the naira, whose purchase at the bank may wait in its queue (R-WALLET-006). */
export function changeFirst(from: readonly Currency[]): Currency | null {
  return from.find((currency) => currency !== "NGN") ?? from[0] ?? null;
}

/** "naira or dollars": the currencies by their names, in the order given. */
export function currencyList(currencies: readonly Currency[]): string {
  return currencies.map((currency) => lowerFirst(say(`ui.currency.${currency}`))).join(" or ");
}
