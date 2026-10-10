// The currencies the wallet keeps and the rate tables the kinds convert with
// (R-ABROAD-001, R-WALLET-009). One list and one reading of the world's rates,
// so every kind values a pocket the same way.
import type { Currency, ForeignCurrency, World } from "../engine/types";

/** Every foreign currency, in the order the rates are listed. */
export const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];

/** Every pocket the wallet keeps: naira, then each foreign currency. */
export const CURRENCIES: readonly Currency[] = ["NGN", ...FOREIGN];

/** Kobo for one unit of each foreign currency at the official rate, as `convertMinor` and `valueInKobo` take it. */
export function officialRates(world: World): Record<ForeignCurrency, number> {
  const rates = {} as Record<ForeignCurrency, number>;
  for (const currency of Object.keys(world.rates) as ForeignCurrency[]) rates[currency] = world.rates[currency].official;
  return rates;
}

/** Kobo for one unit of each foreign currency at the aboki's street rate. */
export function streetRates(world: World): Record<ForeignCurrency, number> {
  const rates = {} as Record<ForeignCurrency, number>;
  for (const currency of Object.keys(world.rates) as ForeignCurrency[]) rates[currency] = world.rates[currency].street;
  return rates;
}
