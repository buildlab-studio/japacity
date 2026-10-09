// What the results sheet reads from the view (docs/rules/world.md R-WORLD-008): the month's money
// lines with their signs, what was kept, the draw's numbers with any of the player's lit, and the
// savings toward the move. Plain functions over the view, so the sheet only lays them out.
import { content } from "@japacity/content";
import type { Currency, PlayerView, ReportLine } from "@japacity/sim";

import { monthlyPayOf } from "../../shared/words/cost";
import { afterPrologue, forYou, isSaid, movesMoney, tidyLines } from "../../shared/words/lines";
import { moneyParam } from "../../shared/words/text";

export interface MoneyLine {
  line: ReportLine;
  /** In (1) or out (-1). */
  sign: 1 | -1;
  currency: Currency;
  amount: number;
  /** A change of money: what came into the other currency, told in the line's words and counted in what was kept. */
  gained?: { currency: Currency; amount: number };
}

/** Lines that carry an amount and a tone but move no money: a deposit flagged is a warning, not a flow. */
const NOT_MOVED: ReadonlySet<string> = new Set(["line.wallet.flagged"]);

const CONVERTED = "line.wallet.converted";
const BANK_CHARGE = "line.wallet.bank-charge";

/**
 * What a change at the bank took in, from its charge. The wallet's line for a change tells only what
 * came in; the charge just before it is R-WALLET-004's share of what was paid in, rounded down, so it
 * pins that to within one unit. A whole figure, as the Bank's chips send, is taken when one fits.
 */
function paidIn(charge: number): number {
  const share = content.tuning.wallet.bankChargeBp;
  const low = Math.ceil((charge * 10_000) / share);
  const high = Math.ceil(((charge + 1) * 10_000) / share) - 1;
  const whole = Math.ceil(low / 100) * 100;
  return whole <= high ? whole : Math.floor((low + high) / 2);
}

/**
 * A change of money as one line (R-WALLET-004, R-WORLD-008): what went out of the one currency, the
 * bank's charge left on its own line, with what came into the other in the line's own words. With
 * no bank's charge just before it (the street, a change that waited), only what came in is known.
 */
function changeLine(line: ReportLine, before: ReportLine | undefined): MoneyLine[] {
  const gained = moneyParam("amount", line.params, line.key);
  if (gained === null || gained.amount === 0) return [];
  const charge = before?.key === BANK_CHARGE ? moneyParam("amount", before.params, before.key) : null;
  if (charge === null || charge.amount === 0 || charge.currency === gained.currency) return [{ line, sign: 1, currency: gained.currency, amount: gained.amount }];
  return [{ line, sign: -1, currency: charge.currency, amount: paidIn(charge.amount) - charge.amount, gained: { currency: gained.currency, amount: gained.amount } }];
}

/**
 * The lines in or out, in the simulation's order, one line for each payment as the report reads
 * them. A good line with an amount is money in, a bad one money out; a change of money is one line
 * with both sides; any other plain line (a move between pockets) moves nothing the player keeps or loses. Only a line that tells money
 * moving counts: a bill that could not be paid, or a scam told after its fee, is not money gone
 * twice (R-WORLD-008).
 */
export function moneyLines(lines: readonly ReportLine[]): MoneyLine[] {
  // The prologue's years are not this month: their money is what the character starts with.
  const tidy = tidyLines(afterPrologue(lines));
  return tidy.flatMap((line, index): MoneyLine[] => {
    if (line.key === CONVERTED) return changeLine(line, tidy[index - 1]);
    if (line.tone === "plain" || NOT_MOVED.has(line.key) || !movesMoney(line)) return [];
    const money = moneyParam("amount", line.params, line.key);
    if (money === null || money.amount === 0) return [];
    return [{ line, sign: line.tone === "good" ? 1 : -1, currency: money.currency, amount: money.amount }];
  });
}

/** The lines that are not money: these live in the phone's News app. */
export function otherLines(lines: readonly ReportLine[]): ReportLine[] {
  const money = new Set(moneyLines(lines).map((entry) => entry.line));
  return tidyLines(lines).filter((line) => !money.has(line));
}

/** The most story lines the results show; the rest stay in News. */
export const STORY_MAX = 6;

/** A charge that fell due and could not be paid: no money moved, but the month went wrong (R-WORLD-008). */
const UNPAID: ReadonlySet<string> = new Set(["line.obligation.missed", "line.obligation.car-notice", "line.obligation.group-visit", "line.obligation.group-covered"]);

/** True for a line that tells a bill not paid. */
export function isUnpaid(line: ReportLine): boolean {
  return UNPAID.has(line.key);
}

/** The visa granted: the month's news, told first and alone in the lead. */
const GRANTED = "line.route.granted";

/**
 * The kinds of line that carry the month's story, in the order the results lead with them: the
 * visa granted, a bill that went unpaid, a hunt's answer, a job or an offer found, a way out heard
 * of or moved on, a paper or a test band, a deposit that will be asked about, a chapter, a goal or
 * an answer told in its offer's own words, a set piece, the interview or a status, news about your
 * plans.
 */
const STORY: readonly ((line: ReportLine) => boolean)[] = [
  (line) => line.key === GRANTED,
  isUnpaid,
  (line) => ["line.activity.hunt-hired", "line.activity.hunt-missed", "line.activity.job-started", "line.activity.side-started", "line.offer.opened"].includes(line.key),
  (line) => line.key.startsWith("line.route."),
  (line) => (line.key.startsWith("line.document.") && line.key !== "line.document.already-pending") || line.key.startsWith("line.activity.driving-"),
  (line) => line.key === "line.wallet.flagged",
  (line) => line.key.startsWith("line.chapter.") || line.key.startsWith("line.goal.") || isSaid(line),
  (line) => line.key.startsWith("line.setpiece.") || line.key.startsWith("line.interview.") || line.key.startsWith("line.status."),
  forYou,
];

function storyRank(line: ReportLine): number {
  return STORY.findIndex((matches) => matches(line));
}

/**
 * The month's story for the results (R-WORLD-008): the lines that move the story, not money, in
 * the order the results lead with them, at most `STORY_MAX`. The rest of the month stays in News.
 */
export function storyLines(lines: readonly ReportLine[]): ReportLine[] {
  return tidyLines(afterPrologue(lines))
    .map((line, index) => ({ line, index, rank: storyRank(line) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, STORY_MAX)
    .map((entry) => entry.line);
}

/** True for the line that leads the results alone: the visa granted. */
export function leadsAlone(line: ReportLine): boolean {
  return line.key === GRANTED;
}

/** What a missed bill cost, by its entry: the credit file abroad, then the standing and the mood its miss takes. */
function unpaidCost(obligation: string): string {
  const entry = content.obligation[obligation as keyof typeof content.obligation];
  if (entry === undefined) return "plain";
  const takes = new Set(entry.onMiss.flatMap((effect) => (effect.type === "quality/add" && effect.amount < 0 ? [effect.quality] : [])));
  const standing = takes.has("quality.standing");
  const mood = takes.has("quality.wellbeing");
  const quality = standing && mood ? "standing-mood" : standing ? "standing" : mood ? "mood" : null;
  if (entry.reportsToCredit === true) return quality === "standing-mood" ? "credit-standing-mood" : "credit";
  return quality ?? "plain";
}

/**
 * A story line as the results tell it (R-WORLD-008): a bill missed says its figure and what it
 * cost, a hunt says the job and its answer, an offer of work says the pay a month. Anything else
 * is told as News tells it.
 */
export function toldOnResults(line: ReportLine): ReportLine {
  const { obligation, job } = line.params;
  if (line.key === "line.obligation.missed" && typeof obligation === "string") return { ...line, key: `ui.results.unpaid.${unpaidCost(obligation)}` };
  if (line.key === "line.activity.hunt-missed" && typeof job === "string") return { ...line, key: "ui.results.hunt-missed" };
  if (line.key === "line.activity.hunt-hired" && typeof job === "string") {
    const pay = monthlyPayOf(job);
    return pay === null ? { ...line, key: "ui.results.hunt-offer-plain" } : { ...line, key: "ui.results.hunt-offer", params: { ...line.params, pay } };
  }
  return line;
}

/** What was kept in each currency the lines moved: in less out, in the order each first appears. */
export function kept(lines: readonly MoneyLine[]): { currency: Currency; amount: number }[] {
  const order: Currency[] = [];
  const sums = new Map<Currency, number>();
  const add = (currency: Currency, amount: number): void => {
    if (!sums.has(currency)) order.push(currency);
    sums.set(currency, (sums.get(currency) ?? 0) + amount);
  };
  for (const { currency, sign, amount, gained } of lines) {
    add(currency, sign * amount);
    if (gained !== undefined) add(gained.currency, gained.amount);
  }
  return order.map((currency) => ({ currency, amount: sums.get(currency) ?? 0 }));
}

/** The money the character lives on where they are: naira at home, the country's own abroad. */
export function localCurrency(view: Pick<PlayerView, "place">): Currency {
  const country = view.place.country;
  if (view.place.where !== "abroad" || country === null) return "NGN";
  return content.country[country]?.currency ?? "NGN";
}

/** The draw's winning numbers, with the player's own among them lit, when the view holds a result. */
export function drawShown(view: Pick<PlayerView, "lottery">): { draw: number; numbers: number[]; matched: number[] } | null {
  const last = view.lottery?.last ?? null;
  if (last === null) return null;
  const numbers = [...new Set(last.winners.flatMap((tier) => tier.tickets))].sort((a, b) => a - b);
  const mine = new Set(view.lottery?.numbers ?? []);
  return { draw: last.draw, numbers, matched: numbers.filter((number) => mine.has(number)) };
}

/**
 * The savings toward the move: the shown funds against what the route in play needs, in its
 * country's money, read live from the checklist's funds item as the route screen reads it. With no
 * funds to show, the japacity figure stands for how far the move is; with neither, nothing.
 */
// the first plan names "the goal's figure from the view"; goals carry no money figure, so the route's funds stand in.
export function savings(view: Pick<PlayerView, "routes" | "japacity">): { kind: "funds"; shown: number; required: number; currency: Currency } | { kind: "percent"; percent: number } | null {
  const route = view.routes.find((candidate) => candidate.id === view.japacity.route) ?? null;
  if (route !== null) {
    const ids = new Set((content.route[route.id]?.checklist ?? []).filter((item) => item.requirement.type === "route/funds").map((item) => item.id));
    const live = route.checklist.find((item) => ids.has(item.id) && item.have !== null && item.need !== null);
    const shown = live?.have ?? route.funds.shown;
    const required = live?.need ?? route.funds.required;
    const country = content.route[route.id]?.country ?? null;
    const currency = (country === null ? undefined : content.country[country]?.currency) ?? "GBP";
    if (required > 0) return { kind: "funds", shown, required, currency };
  }
  return view.japacity.percent === null ? null : { kind: "percent", percent: view.japacity.percent };
}

function sameLine(a: ReportLine, b: ReportLine): boolean {
  return a.key === b.key && JSON.stringify(a.params) === JSON.stringify(b.params);
}

/** The month's lines that neither the story nor the money tells on the results: these are left for News. */
export function untoldLines(lines: readonly ReportLine[]): ReportLine[] {
  const story = storyLines(lines);
  return otherLines(lines).filter((line) => {
    const at = story.findIndex((told) => sameLine(told, line));
    if (at === -1) return true;
    story.splice(at, 1);
    return false;
  });
}
