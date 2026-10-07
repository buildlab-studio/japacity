// Every word on screen comes through here: content's table first, then the
// interface's own first drafts. A missing key shows as itself, so a gap in
// content is visible in play instead of hidden behind a guess.
import { text } from "@japacity/content";

import { formatBand, formatBp, formatMoney, formatNumber, isCurrency } from "./format";
import { uiText } from "./ui";

export type Params = Record<string, string | number>;

const BRACE = /\{([A-Za-z][\w-]*)\}/g;

export function hasWords(key: string): boolean {
  return text[key] !== undefined || uiText[key] !== undefined;
}

function lookup(key: string): string {
  return text[key] ?? uiText[key] ?? key;
}

/**
 * Params whose numbers are money. The view gives a line's params as bare
 * numbers, so the name is the only hint; a `currency` param names the
 * currency, and naira is assumed without one. See the report: the view
 * would need typed params.
 */
const MONEY_PARAMS = new Set([
  "amount",
  "price",
  "show",
  "gift",
  "cost",
  "fee",
  "pay",
  "paid",
  "due",
  "owed",
  "principal",
  "salary",
  "deposit",
  "refund",
  "shown",
  "required",
  "total",
  "discount",
  "min",
  "max",
]);

/** One raw param from the simulation, as words. */
export function formatParam(name: string, value: string | number, params: Params): string {
  if (typeof value === "string") return text[`${value}.name`] ?? value;
  if (name === "band") return formatBand(value);
  if (name === "bp" || name.endsWith("Bp")) return formatBp(value);
  if (MONEY_PARAMS.has(name)) {
    const currency = params.currency;
    return formatMoney(value, isCurrency(currency) ? currency : "NGN");
  }
  return formatNumber(value);
}

/** Words for a key the simulation chose (a report line, an offer body), with its raw params formatted. */
export function words(key: string, params: Params = {}): string {
  return lookup(key).replace(BRACE, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : formatParam(name, value, params);
  });
}

/** Words for the interface, with params the screen has already formatted. */
export function say(key: string, params: Params = {}): string {
  return lookup(key).replace(BRACE, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

/** An entry's name: `<id>.name`. */
export function nameOf(id: string): string {
  return lookup(`${id}.name`);
}

/** An entry's one-line description, or null when content has none. */
export function blurbOf(id: string): string | null {
  return text[`${id}.blurb`] ?? null;
}
