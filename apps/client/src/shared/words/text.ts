// Every word on screen comes through here: content's table first, then the
// interface's own first drafts. A missing key shows as itself, so a gap in
// content is visible in play instead of hidden behind a guess.
import { content, text } from "@japacity/content";
import type { Currency, MoneyParam, ReportParam } from "@japacity/sim";

import { formatBand, formatBp, formatMoney, formatNumber, isCurrency } from "./format";
import { uiText } from "./ui";

export type Params = Record<string, ReportParam>;

const BRACE = /\{([A-Za-z][\w-]*)\}/g;

export function hasWords(key: string): boolean {
  return text[key] !== undefined || uiText[key] !== undefined;
}

function lookup(key: string): string {
  return text[key] ?? uiText[key] ?? key;
}

/**
 * Params whose bare numbers are money, for lines that still carry money as a
 * bare number. A typed `{ currency, amount }` param never needs this list
 * (docs/rules/text.md, "Money on screen"); it stays only until every kind
 * sends typed money.
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

/** A line with one of these is about a quality or a score, so its bare `amount` is points, never money. */
const QUALITY_LINE_PARAMS = ["quality", "points", "band"];

/** Lines about a route's school or funds count in pounds. */
const POUND_LINES = "line.route.";

/** True when a bare number in this line is money, by the old name guess. */
export function isBareMoney(name: string, params: Params): boolean {
  if (!MONEY_PARAMS.has(name)) return false;
  return !QUALITY_LINE_PARAMS.some((param) => param in params);
}

/** The currency of a bare money number, from what else the line carries. Naira when nothing says otherwise. */
function bareCurrency(name: string, params: Params, key: string): Currency {
  if (name === "paid" && isCurrency(params.from)) return params.from;
  if (isCurrency(params.currency)) return params.currency;
  const obligation = params.obligation;
  if (typeof obligation === "string") {
    const owed = (content.obligation as Record<string, { currency: Currency } | undefined>)[obligation];
    if (owed !== undefined) return owed.currency;
  }
  if (key.startsWith(POUND_LINES)) return "GBP";
  return "NGN";
}

// Names that read as common nouns mid-sentence: "You look for work as a private
// school teacher", "Your passport is ready". Schools, people, news and places keep
// their capitals.
const LOWER_KINDS = new Set(["activity", "document", "route", "quality", "obligation", "status"]);
const PROPER_WORDS = new Set(["English", "British", "Canada", "Canadian", "December", "United", "Nigerian", "Lagos", "Gulf", "Dubai", "QuickNaira"]);

/** A name with its first letter lowered, unless it starts with an acronym or a proper noun. */
export function lowerFirst(name: string): string {
  const first = name.split(/[\s,']/)[0] ?? "";
  if (first.length > 1 && first === first.toUpperCase()) return name;
  if (PROPER_WORDS.has(first)) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** An entry's name as it reads inside a sentence. */
export function runningName(id: string): string {
  const name = nameOf(id);
  const kind = id.split(".")[0] ?? "";
  return LOWER_KINDS.has(kind) && hasWords(`${id}.name`) ? lowerFirst(name) : name;
}

/** A line's money param as typed money, whether it came typed or as a bare number. Null when it is not money. */
export function moneyParam(name: string, params: Params, key: string): MoneyParam | null {
  const value = params[name];
  if (typeof value === "object") return value;
  if (typeof value !== "number" || !isBareMoney(name, params)) return null;
  return { currency: bareCurrency(name, params, key), amount: value };
}

/** True when a brace at this offset opens a sentence or follows a colon, where a name keeps its capital. */
function opensSentence(whole: string, offset: number): boolean {
  const before = whole.slice(0, offset).trimEnd();
  return before === "" || /[.:!?"(]$/.test(before);
}

function stringParam(name: string, value: string, midSentence: boolean): string {
  if (name === "pocket" && hasWords(`ui.pocket.${value}`)) return say(`ui.pocket.${value}`);
  if (name === "currency" && hasWords(`ui.currency.${value}`)) return lowerFirst(say(`ui.currency.${value}`));
  if (name === "reason" && hasWords(`ui.refusal.${value}`)) return lowerFirst(say(`ui.refusal.${value}`));
  if (text[`${value}.name`] === undefined) return value;
  return midSentence ? runningName(value) : nameOf(value);
}

/** One raw param from the simulation, as words. */
export function formatParam(name: string, value: ReportParam, params: Params, key = "", midSentence = false): string {
  if (typeof value === "object") return formatMoney(value.amount, value.currency);
  if (typeof value === "string") return stringParam(name, value, midSentence);
  if (name === "band") return formatBand(value);
  if (name === "bp" || name.endsWith("Bp")) return formatBp(value);
  if (isBareMoney(name, params)) return formatMoney(value, bareCurrency(name, params, key));
  return formatNumber(value);
}

/** Words for a key the simulation chose (a report line, an offer body), with its raw params formatted. */
export function words(key: string, params: Params = {}): string {
  const template = lookup(key);
  return template.replace(BRACE, (whole, name: string, offset: number) => {
    const value = params[name];
    return value === undefined ? whole : formatParam(name, value, params, key, !opensSentence(template, offset));
  });
}

/** Words for the interface, with params the screen has already formatted. */
export function say(key: string, params: Params = {}): string {
  return lookup(key).replace(BRACE, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    if (typeof value === "object") return formatMoney(value.amount, value.currency);
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

/**
 * Words for a count: `<key>.one` when the count is one and `<key>.zero` when it
 * is none, where those exist, so the screen never says "1 months".
 */
export function sayCount(key: string, count: number, params: Params = {}): string {
  const exact = count === 1 ? `${key}.one` : count === 0 ? `${key}.zero` : null;
  return say(exact !== null && hasWords(exact) ? exact : key, params);
}

/** An entry's name: `<id>.name`. */
export function nameOf(id: string): string {
  return lookup(`${id}.name`);
}

/** An entry's one-line description, or null when content has none. */
export function blurbOf(id: string): string | null {
  return text[`${id}.blurb`] ?? null;
}
