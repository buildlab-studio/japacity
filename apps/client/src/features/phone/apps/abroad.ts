// The Bank abroad when the month's dues pass the country's money held (world:phone-holds-what-phones-hold): which
// money to change first, and the monies named for the way. The gap itself is read in shared/words/dues.ts, which
// the nudge reads too; the words are in content's ui/ui.phone.text.ts.
import type { Currency } from "@japacity/sim";

import { lowerFirst, say } from "../../../shared/words/text";

/** The money to change first: a foreign currency before the naira, whose purchase at the bank may wait in its queue (wallet:bank-queue-delays-purchases). */
export function changeFirst(from: readonly Currency[]): Currency | null {
  return from.find((currency) => currency !== "NGN") ?? from[0] ?? null;
}

/** "naira or dollars": the currencies by their names, in the order given. */
export function currencyList(currencies: readonly Currency[]): string {
  return currencies.map((currency) => lowerFirst(say(`ui.currency.${currency}`))).join(" or ");
}
