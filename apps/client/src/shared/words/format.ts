// Numbers as the player reads them. The view carries whole numbers of the
// smallest unit; only here do they become naira, pounds and dollars.
import type { Currency } from "@japacity/sim";

const MINOR_PER_MAJOR = 100;

const moneyFormats = new Map<Currency, Intl.NumberFormat>();

// One formatter per currency, made once (docs/research/23-interface-stack.md
// section 8). narrowSymbol keeps the naira sign even where en-NG data is missing.
function moneyFormat(currency: Currency): Intl.NumberFormat {
  let format = moneyFormats.get(currency);
  if (format === undefined) {
    format = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    moneyFormats.set(currency, format);
  }
  return format;
}

/** A whole number of kobo, pence or cents, as money. */
export function formatMoney(minor: number, currency: Currency): string {
  return moneyFormat(currency).format(minor / MINOR_PER_MAJOR);
}

/** A sign for one unit: "£1", "$1". */
export function formatOne(currency: Currency): string {
  return moneyFormat(currency).format(1);
}

/** Whole major units typed by the player, as minor units for a command. */
export function toMinor(major: number): number {
  return Math.round(major * MINOR_PER_MAJOR);
}

export function toMajor(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

const plain = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return plain.format(value);
}

const bandFormat = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** An English band is kept times ten: 65 is band 6.5. */
export function formatBand(tenths: number): string {
  return bandFormat.format(tenths / 10);
}

const percentFormat = new Intl.NumberFormat("en-NG", { style: "percent", maximumFractionDigits: 1 });

/** Basis points as a percentage: 2500 is 25%. */
export function formatBp(bp: number): string {
  return percentFormat.format(bp / 10000);
}

export const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD"];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}
