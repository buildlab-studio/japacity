// What the results sheet reads from the view (docs/rules/world.md R-WORLD-008): the month's money
// lines with their signs, what was kept, the draw's numbers with any of the player's lit, and the
// savings toward the move. Plain functions over the view, so the sheet only lays them out.
import { content } from "@japacity/content";
import type { Currency, PlayerView, ReportLine } from "@japacity/sim";

import { monthlyPayOf } from "../../shared/words/cost";
import { countWords } from "../../shared/words/count";
import { afterPrologue, forYou, isSaid, isUnpaid, movesMoney, tidyLines, toldUnpaid } from "../../shared/words/lines";
import { BANK_CHARGE, CONVERT_PAID, CONVERTED, type MoneyLine, moneyLines } from "../../shared/words/money";
import { moneyParam } from "../../shared/words/text";

// The month's money lines live in shared/words/money.ts, so the Bank's Lately reads the same lines (R-WORLD-019).
export { CHANGED, CHANGED_OUT, type MoneyLine, moneyLines } from "../../shared/words/money";

/** The lines that are not money: these live in the phone's News app. */
export function otherLines(lines: readonly ReportLine[]): ReportLine[] {
  const money = new Set(moneyLines(lines).map((entry) => entry.line));
  // A change at the bank is told by the results' own line, the change and its charge together.
  return tidyLines(lines).filter((line, index, all) => !money.has(line) && line.key !== CONVERTED && line.key !== CONVERT_PAID && !(line.key === BANK_CHARGE && (all[index + 1]?.key === CONVERTED || (all[index + 1]?.key === CONVERT_PAID && all[index + 2]?.key === CONVERTED))));
}

/** The most story lines the results show; the rest stay in News. */
export const STORY_MAX = 6;

/** A charge that fell due and could not be paid: no money moved, but the month went wrong (R-WORLD-008). */


/** True for a line that tells a bill not paid. */
export { isUnpaid };

/** A hunt that brought an offer, and the job offer it opens for the answer. */
const HIRED = "line.activity.hunt-hired";
const OPENED = "line.offer.opened";
const JOB_OFFER = "offer.job";

/** The visa granted: the month's news, told first and alone in the lead. */
const GRANTED = "line.route.granted";

/** The settlement cleared (docs/rules/home.md R-HOME-003), with cash lost or none: it leads the month, before anything else. */
const EVICTED: ReadonlySet<string> = new Set(["line.home.evicted", "line.home.evicted-no-cash"]);

/** True for the line that tells the room on the water is gone: first, and in the money's red as a bill unpaid is. */
export function isEvicted(line: ReportLine): boolean {
  return EVICTED.has(line.key);
}

/** A piece added to the portfolio, as the results tell the portfolio's own line. */
const PIECE = "line.activity.piece-built";
const PIECE_MORE = "line.activity.piece-built-more";
const PORTFOLIO = "quality.portfolio";

/** The exam marked: the score and what a pass needs (R-ACTIVITY-013). */
const EXAM_MARKED: ReadonlySet<string> = new Set(["line.activity.exam-passed", "line.activity.exam-failed"]);

/**
 * What the waiting months' acts came to (R-ACTIVITY-013): the exam's score, a piece for the portfolio,
 * open source's first merge or its quiet month, the raise or the month nobody said anything. Each is
 * told the month it happens, with the hunt's answer.
 */
const ACTS: ReadonlySet<string> = new Set([...EXAM_MARKED, PIECE, PIECE_MORE, "line.activity.first-merged", "line.activity.contributed", "line.activity.raised", "line.activity.not-noticed"]);

/** The set pieces an act's exam is sat in: once its score is told, "the exam is over" says nothing more. */
const EXAMS: ReadonlySet<string> = new Set(Object.values(content.activity).flatMap((entry) => (entry?.exam === undefined ? [] : [entry.exam.setpiece])));

/** The most pieces any route's checklist asks for: what a piece is counted toward. */
const PIECES_ASKED = Math.max(
  0,
  ...Object.values(content.route)
    .flatMap((route) => route?.checklist ?? [])
    .flatMap((item) => (item.requirement.type === "quality/min" && item.requirement.quality === PORTFOLIO ? [item.requirement.value] : [])),
);

/**
 * The portfolio rising, told as a piece for it (R-ACTIVITY-013): how many of what a route asks, or past
 * that, how many there are. Any other line is itself.
 */
function asPiece(line: ReportLine): ReportLine {
  const { quality, value } = line.params;
  if (line.key !== "line.quality.gain" || quality !== PORTFOLIO || typeof value !== "number") return line;
  return value > PIECES_ASKED ? { ...line, key: PIECE_MORE, params: { pieces: value } } : { ...line, key: PIECE, params: { pieces: value, need: PIECES_ASKED } };
}

/**
 * The kinds of line that carry the month's story, in the order the results lead with them: the
 * room in Makoko cleared away, the visa granted, a bill that went unpaid, what the room's basics saved, a hunt's answer, a job or an offer found, what an act came to, a way out heard
 * of or moved on, a paper or a test band, a deposit that will be asked about, a chapter, a goal or
 * an answer told in its offer's own words, a set piece, the interview or a status, news about your
 * plans.
 */
const STORY: readonly ((line: ReportLine) => boolean)[] = [
  isEvicted,
  (line) => line.key === GRANTED,
  isUnpaid,
  // R-OBLIGATION-014: what cooking and fetching water saved on the upkeep, each its own line.
  (line) => ["line.activity.hunt-hired", "line.activity.hunt-missed", "line.activity.job-started", "line.activity.side-started", "line.offer.opened"].includes(line.key),
  (line) => ACTS.has(line.key),
  // The adviser's reading, paid for, leads the route's own lines.
  (line) => ["line.activity.adviser-missing", "line.activity.adviser-fits"].includes(line.key),
  (line) => line.key.startsWith("line.route."),
  (line) => (line.key.startsWith("line.document.") && line.key !== "line.document.already-pending") || line.key.startsWith("line.activity.driving-"),
  (line) => line.key === "line.wallet.flagged",
  (line) => line.key.startsWith("line.chapter.") || line.key.startsWith("line.goal.") || isSaid(line),
  (line) => line.key.startsWith("line.setpiece.") || line.key.startsWith("line.interview.") || line.key.startsWith("line.status."),
  forYou,
  // The month's chores (food cooked, water fetched) come after the month's events.
  (line) => line.key.startsWith("line.obligation.relief."),
];

function storyRank(line: ReportLine): number {
  return STORY.findIndex((matches) => matches(line));
}

/**
 * The month's story for the results (R-WORLD-008): the lines that move the story, not money, in
 * the order the results lead with them, at most `STORY_MAX`. The rest of the month stays in News.
 */
/** The relative's gift answered says the flag and the way round it itself: the wallet's bare flag line is not told twice. */
const RELATIVE_SENDS = "offer.relative-sends";
function flagTold(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.key === "line.offer.taken" && line.params["offer"] === RELATIVE_SENDS);
}

export function storyLines(lines: readonly ReportLine[]): ReportLine[] {
  const tidy = tidyLines(afterPrologue(lines));
  // A hunt's offer already names the job and its pay: the offer it opens is not told again.
  const hired = tidy.some((line) => line.key === HIRED);
  const flagged = flagTold(tidy);
  const marked = tidy.some((line) => EXAM_MARKED.has(line.key));
  return tidy
    .filter((line) => !(hired && line.key === OPENED && line.params.offer === JOB_OFFER))
    .filter((line) => !(flagged && line.key === "line.wallet.flagged"))
    .filter((line) => !(marked && line.key === "line.setpiece.closed" && typeof line.params.setpiece === "string" && EXAMS.has(line.params.setpiece)))
    .map(asPiece)
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

/**
 * A story line as the results tell it (R-WORLD-008): a bill missed says its figure and what it
 * cost, a hunt says the job and its answer, an offer of work says the pay a month. Anything else
 * is told as News tells it.
 */
export function toldOnResults(line: ReportLine): ReportLine {
  const { job } = line.params;
  // A score or a count of pieces reads as a person says it: "one of three", never "1 of 3" (R-TEXT-005).
  if (EXAM_MARKED.has(line.key) || line.key === PIECE || line.key === PIECE_MORE) return { ...line, params: Object.fromEntries(Object.entries(line.params).map(([name, value]) => [name, typeof value === "number" ? countWords(value) : value])) };
  if (line.key === "line.obligation.missed") return toldUnpaid(line);
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
  for (const { currency, sign, amount } of lines) add(currency, sign * amount);
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
export function savings(view: Pick<PlayerView, "routes" | "japacity"> & Partial<Pick<PlayerView, "place">>): { kind: "funds"; shown: number; required: number; currency: Currency } | { kind: "percent"; percent: number } | null {
  // Once flown, the move is made: no target on the results.
  if (view.place?.where === "abroad") return null;
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

/** A small ask a run passed (R-WORLD-028), told in the quiet line as passed by, not as asking for an answer. */
export const QUIET_PASSED = "ui.month.quiet.passed";

/** The credit file's move over a quiet month, as the store adds it to the month's lines. */
export const CREDIT_UP = "ui.month.quiet.credit-up";
export const CREDIT_DOWN = "ui.month.quiet.credit-down";
const CREDIT_MOVED: ReadonlySet<string> = new Set([CREDIT_UP, CREDIT_DOWN]);

function toldQuiet(line: ReportLine): ReportLine {
  const offer = line.params["offer"];
  if (line.key === OPENED && typeof offer === "string" && content.offer[offer as keyof typeof content.offer]?.news === false) return { ...line, key: QUIET_PASSED };
  return toldOnResults(line);
}

/**
 * A quiet month of an Until news run as its one line (R-WORLD-028): what was kept in the money the
 * character lives on, and the one thing that moved: the month's first story line (a small ask passed
 * by told as such), else the credit file going up or down ("Kept £340. Credit up."), else nothing.
 */
export function quietLine(lines: readonly ReportLine[], local: Currency): { kept: number | null; moved: ReportLine | null } {
  const money = moneyLines(lines, local);
  const net = kept(money).find((entry) => entry.currency === local);
  const [first] = storyLines(lines);
  const credit = lines.find((line) => CREDIT_MOVED.has(line.key));
  return { kept: money.length === 0 || net === undefined ? null : net.amount, moved: first !== undefined ? toldQuiet(first) : (credit ?? null) };
}
