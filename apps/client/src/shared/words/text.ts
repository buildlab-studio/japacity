// Every word on screen comes through here: content's table first, then the
// interface's own words. A missing key shows as itself, so a gap in
// content is visible in play instead of hidden behind a guess.
import { content, HOMETOWN_FILL, text } from "@japacity/content";
import type { Currency, MoneyParam, ReportParam } from "@japacity/sim";

import { formatBand, formatBp, formatMoney, formatNumber, isCurrency, monthEnding } from "./format";
import { nowHometown, nowMonth, swapped } from "./now";
import { peopleParam } from "./people";
import { lateWord } from "./late";
import { uiText } from "./ui";

export type Params = Record<string, ReportParam>;

const BRACE = /\{([A-Za-z][\w-]*)\}/g;

export function hasWords(key: string): boolean {
  return text[key] !== undefined || uiText[key] !== undefined || lateWord(key) !== undefined;
}

function lookup(key: string): string {
  // A computer person never carries the player's own first name (R-PEOPLE-061).
  return swapped(key, text[key] ?? uiText[key] ?? lateWord(key) ?? key);
}

/**
 * Content's placeholder for where the life is from (prologue.md R-PROLOGUE-002): `{hometown}` in
 * any line names the town of the life on screen, so one line serves every hometown. A line that is handed its own
 * `hometown` says that one. With no life on screen, or its family not drawn yet, "your hometown".
 */
const HOMETOWN = HOMETOWN_FILL;

/** The name of where the life on screen is from, or "your hometown" where none is known. */
export function hometownWords(id: string | null = nowHometown()): string {
  return id !== null && hasWords(`${id}.name`) ? lookup(`${id}.name`) : lookup("ui.hometown.unknown");
}

/** A line with its `{hometown}` filled from the life on screen; everything else left as it was. */
function withHometown(line: string): string {
  return line.includes(`{${HOMETOWN}}`) ? line.replaceAll(`{${HOMETOWN}}`, hometownWords()) : line;
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

/**
 * Params that name a month in content's lines: each is a month whose end brings what the line
 * says. They read as months away from the month in hand ("in 2 months"), so no running month
 * number shows (R-WORLD-002); `until` reads as how long it holds ("for 3 more months").
 */
const MONTH_PARAMS = new Set(["month", "until", "readyMonth"]);

/** A stamped month in a line, as months away from the month in hand; with no game on screen, as its number. */
function monthParam(name: string, stamped: number): string {
  const now = nowMonth();
  if (now === null) return say(name === "until" ? "ui.until-month" : "ui.in-month", { month: formatNumber(monthEnding(stamped)) });
  return name === "until" ? forMonths(stamped, now) : inMonths(stamped, now);
}

/** A line with one of these is about a quality or a score, so its bare `amount` is points, never money. */
const QUALITY_LINE_PARAMS = ["quality", "points", "band"];

/** Lines about a route's school or funds count in pounds. */
const POUND_LINES = "line.route.";

/** True when a bare number in this line is money, guessed from the param's name. */
function isBareMoney(name: string, params: Params): boolean {
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
export const LOWER_KINDS: ReadonlySet<string> = new Set(["activity", "document", "route", "quality", "obligation", "status", "thing"]);
/** First words that keep their capital mid-sentence. words.test.ts holds this against every name and country in content. */
export const PROPER_WORDS: ReadonlySet<string> = new Set([
  "English",
  "British",
  "Canada",
  "Canadian",
  "December",
  "United",
  "Italy",
  "Nigeria",
  "Nigerian",
  "Lagos",
  "Gulf",
  "Dubai",
  "QuickNaira",
]);

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
  // A slot lock's reason (R-TURN-009), as the Month sheet says it: "your side job", never its key.
  if (name === "why" && hasWords(`ui.locks.why.${value}`)) {
    const why = say(`ui.locks.why.${value}`);
    return midSentence ? why : why.charAt(0).toUpperCase() + why.slice(1);
  }
  if (name === "currency" && hasWords(`ui.currency.${value}`)) return lowerFirst(say(`ui.currency.${value}`));
  if (name === "reason" && hasWords(`ui.refusal.${value}`)) return lowerFirst(say(`ui.refusal.${value}`));
  if (text[`${value}.name`] === undefined) return value;
  return midSentence ? runningName(value) : nameOf(value);
}

/** One raw param from the simulation, as words. */
export function formatParam(name: string, value: ReportParam, params: Params, key = "", midSentence = false): string {
  if (typeof value === "object") return formatMoney(value.amount, value.currency);
  if (typeof value === "string") return (key.startsWith("line.people.") ? peopleParam(name, value, midSentence) : null) ?? stringParam(name, value, midSentence);
  if (name === "band") return formatBand(value);
  if (MONTH_PARAMS.has(name)) return monthParam(name, value);
  if (name === "bp" || name.endsWith("Bp")) return formatBp(value);
  if (isBareMoney(name, params)) return formatMoney(value, bareCurrency(name, params, key));
  return formatNumber(value);
}

/**
 * Lines whose count reads wrong at one, by the param that counts. At one the
 * interface's `ui.<key>.one` words are used, as `sayCount` does for its own.
 */
const LINE_COUNTS: Record<string, string> = {
  "line.setpiece.opened": "questions",
  "line.activity.lotto-won": "tickets",
  "line.activity.lotto-lost": "tickets",
  "line.status.clock-started": "months",
  "line.status.clock-ran": "months",
  "line.status.renewed": "months",
  "line.status.removed": "months",
  "line.place.token-lapsed": "months",
  "line.activity.adviser-missing": "months",
};

/**
 * Lines said by their source, by the param that names it: `<key>.<source>` where content has words for that source,
 * so a route heard of reads as where the word came from, never as what the player heard (R-TEXT-007).
 */
const LINE_SOURCES: Record<string, string> = { "line.route.heard": "via" };

function sourcedKey(key: string, params: Params): string {
  const named = LINE_SOURCES[key];
  const source = named === undefined ? undefined : params[named];
  return typeof source === "string" && hasWords(`${key}.${source}`) ? `${key}.${source}` : key;
}

function countedKey(key: string, params: Params): string {
  const counted = LINE_COUNTS[key];
  if (counted === undefined) return sourcedKey(key, params);
  const count = params[counted];
  return typeof count === "number" && count === 1 && hasWords(`ui.${key}.one`) ? `ui.${key}.one` : key;
}

/** How many bands a quality's value is told in, from the bottom: the words never show the figure. */
const BANDS = 4;

/**
 * A quality's value as the band it is in, as a sentence a person would say ("Your family has a
 * little behind it"), or null when the quality has no band words. The figure itself never shows.
 */
export function bandWords(quality: string, value: number): string | null {
  const entry = bandedRange(quality);
  if (entry === null) return null;
  const span = entry.max - entry.min + 1;
  const band = Math.min(BANDS - 1, Math.max(0, Math.floor(((value - entry.min) * BANDS) / span)));
  return say(`ui.band.${quality}.${String(band)}`);
}

/** A quality's range when it has band words, else null. */
function bandedRange(quality: string): { min: number; max: number } | null {
  const entry = (content.quality as Record<string, { min: number; max: number } | undefined>)[quality];
  return entry === undefined || !hasWords(`ui.band.${quality}.0`) ? null : entry;
}

/**
 * The band a gate on a quality opens at, said as a promise ("once your tech is good"): the lowest band
 * whose every value meets the gate, else the top band. Null when the quality has no band words.
 */
export function bandOpening(quality: string, gate: number): number | null {
  const entry = bandedRange(quality);
  if (entry === null) return null;
  const span = entry.max - entry.min + 1;
  // The lowest value in band n is the first whose share of the range reaches n quarters.
  const opens = [0, 1, 2, 3].find((n) => entry.min + Math.ceil((n * span) / BANDS) >= gate);
  return opens ?? BANDS - 1;
}

/** Lines that tell a quality's move, and which way each tells it. */
const QUALITY_MOVES: Record<string, "gain" | "loss" | "worn" | "drift"> = {
  "line.quality.gain": "gain",
  "line.quality.loss": "loss",
  "line.quality.worn": "worn",
  "line.quality.drift": "drift",
};

/**
 * A quality's move as what a person would notice (R-TEXT-005): "You know a few more people
 * now", never "Network up". Wear from work says the work; the month's drift says where wellbeing settles against its
 * resting point (R-QUALITY-004). Null when content has no words for that move.
 */
function movedWords(quality: string, way: "gain" | "loss" | "worn" | "drift", value: number | null): string | null {
  const told = `line.quality.told.${quality}`;
  const rest = content.tuning.quality.wellbeingDriftTo;
  const key = way === "drift" ? `${told}.drift.${value === null || value === rest ? "rest" : value < rest ? "below" : "above"}` : way === "worn" && !hasWords(`${told}.worn`) ? `${told}.loss` : `${told}.${way}`;
  return hasWords(key) ? say(key) : null;
}

function bandLine(key: string, params: Params): string | null {
  const way = QUALITY_MOVES[key];
  const { quality, value, points } = params;
  if (way === undefined || typeof quality !== "string") return null;
  const band = typeof value === "number" ? bandWords(quality, value) : null;
  // A quality with a named level and no bands (education, the degree grade) says the level, never its figure.
  const label = typeof value === "number" ? `${quality}.value.${String(value)}` : null;
  if (band === null && label !== null && hasWords(label)) return say("ui.line.quality.label", { quality: nameOf(quality), value: say(label) });
  // From nothing (the prologue's draw), the band alone says where the character starts.
  if (way === "gain" && band !== null && points === value) return say("ui.line.quality.start-band", { band });
  // Else what the move is to a person; with no words for it, where it leaves them, said as the band.
  return movedWords(quality, way, typeof value === "number" ? value : null) ?? (band === null ? null : say("ui.line.quality.start-band", { band }));
}

/** Words for a key the simulation chose (a report line, an offer body), with its raw params formatted. */
export function words(key: string, params: Params = {}): string {
  const banded = bandLine(key, params);
  if (banded !== null) return banded;
  const template = lookup(countedKey(key, params));
  return template.replace(BRACE, (whole, name: string, offset: number) => {
    const value = params[name];
    if (value === undefined) return name === HOMETOWN ? hometownWords() : whole;
    return formatParam(name, value, params, key, !opensSentence(template, offset));
  });
}

/** Words for the interface, with params the screen has already formatted. */
export function say(key: string, params: Params = {}): string {
  return lookup(key).replace(BRACE, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return name === HOMETOWN ? hometownWords() : whole;
    if (typeof value === "object") return formatMoney(value.amount, value.currency);
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

/** A month the simulation stamps, told as months from the month in hand: "in 2 months", "next month", "this month" (R-WORLD-002). */
export function inMonths(stamped: number, now: number): string {
  const count = Math.max(0, stamped - now);
  return sayCount("ui.in-months", count, { count });
}

/** A deadline the month ends on, told as "by next month", "within 3 months", "this month" (R-WORLD-002). */
export function byMonths(stamped: number, now: number): string {
  const count = Math.max(0, stamped - now);
  return sayCount("ui.by-months", count, { count });
}

/** How long something holds until a stamped month, told as "for 3 more months", "for one more month", "until this month ends" (R-WORLD-002). */
export function forMonths(stamped: number, now: number): string {
  const count = Math.max(0, stamped - now);
  return sayCount("ui.for-months", count, { count });
}

/** A month gone by, told as "2 months ago", "Last month", "This month" (R-WORLD-002). */
export function monthsAgo(stamped: number, now: number): string {
  const count = Math.max(0, now - stamped);
  return sayCount("ui.months-ago", count, { count });
}

/**
 * Words for a count: `<key>.one` when the count is one and `<key>.zero` when it
 * is none, where those exist, so the screen never says "1 months".
 */
export function sayCount(key: string, count: number, params: Params = {}): string {
  const exact = count === 1 ? `${key}.one` : count === 0 ? `${key}.zero` : null;
  return say(exact !== null && hasWords(exact) ? exact : key, params);
}

/** A slot's param as words: an entry's name, or a count of tickets at the kiosk, which picks a number (R-LUCK-005). */
export function paramWords(param: string): string {
  if (hasWords(`${param}.name`)) return nameOf(param);
  if (!/^\d+$/.test(param)) return param;
  const count = Number(param);
  return sayCount("ui.activity.tickets", count, { count });
}

/** An entry's name: `<id>.name`. */
export function nameOf(id: string): string {
  return withHometown(lookup(`${id}.name`));
}

/** An entry's one-line description, or null when content has none. */
export function blurbOf(id: string): string | null {
  const blurb = text[`${id}.blurb`];
  return blurb === undefined ? null : withHometown(blurb);
}
