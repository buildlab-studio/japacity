// The currencies the wallet keeps, what a pocket has to spend, the money of a
// place, and the rate tables the kinds convert with (abroad-money:foreign-currencies-join-wallet,
// wallet:foreign-fee-payment-order). One list and one reading of the world's rates, so every kind
// values a pocket the same way.
import type { Content, Currency, ForeignCurrency, PlaceSlice, World } from "../engine/types";

/** Every foreign currency, in the order the rates are listed. */
export const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];

/** Every pocket the wallet keeps: naira, then each foreign currency. */
export const CURRENCIES: readonly Currency[] = ["NGN", ...FOREIGN];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** A currency's money that can be spent: the bank and the cash together, the locked left aside. */
export function spendable(pocket: { bank: number; cash: number }): number {
  return pocket.bank + pocket.cash;
}

/** The money of the place: naira at home and on the road, the country's own abroad. */
export function placeCurrency(place: Pick<PlaceSlice, "where" | "country">, content: Pick<Content, "country">): Currency {
  const country = place.country;
  if (place.where !== "abroad" || country === null) return "NGN";
  return content.country[country]?.currency ?? "NGN";
}

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
