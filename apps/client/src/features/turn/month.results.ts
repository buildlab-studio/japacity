// What the results sheet reads from the view (docs/rules/world.md R-WORLD-008): the month's money
// lines with their signs, what was kept, the draw's numbers with any of the player's lit, and the
// savings toward the move. Plain functions over the view, so the sheet only lays them out.
import { content } from "@japacity/content";
import type { Currency, MoneyParam, PlayerView, ReportLine } from "@japacity/sim";

import { afterPrologue, forYou, isSaid, isUnpaid, tidyLines } from "../../shared/words/lines";
import { BANK_CHARGE, CHANGED, CHANGED_OUT, CHANGED_QUEUED, CHANGED_SMALL, CHANGED_STREET, CHANGED_STREET_OUT, CONVERT_PAID, CONVERTED, LOTTO_PAID, LOTTO_TICKETS, type MoneyLine, moneyLines } from "../../shared/words/money";
import { moneyParam } from "../../shared/words/text";
import type { PayView } from "../../shared/words/cost";
import { expiringSoon } from "../../shared/words/expiry";
import { savingsOf } from "../../shared/words/savings";
import { EXAM_MARKED, PIECE, PIECE_MORE, asPiece, toldOnResults } from "../../shared/words/told";

// How a line is told on the results lives in shared/words/told.ts, so News tells the month in the same words (R-WORLD-008).
export { asPiece, toldOnResults };

// The month's money lines live in shared/words/money.ts, so the Bank's Lately reads the same lines (R-WORLD-019).
export { CHANGED, CHANGED_OUT, type MoneyLine, moneyLines } from "../../shared/words/money";

/** The lines that are not money: these live in the phone's News app. */
export function otherLines(lines: readonly ReportLine[]): ReportLine[] {
  const money = new Set(moneyLines(lines).map((entry) => entry.line));
  // A change at the bank is told by the results' own line, the change and its charge together.
  return tidyLines(lines).filter((line, index, all) => !money.has(line) && line.key !== CONVERTED && line.key !== CONVERT_PAID && !(line.key === BANK_CHARGE && (all[index + 1]?.key === CONVERTED || (all[index + 1]?.key === CONVERT_PAID && all[index + 2]?.key === CONVERTED))));
}

/** The most story lines the results show; the rest stay in News. The month's chores are told after these, never cut. */
export const STORY_MAX = 6;

/**
 * The chores' own lines (R-OBLIGATION-014): one for each activity whose `obligation/relief` lowered the living costs,
 * keyed by its slug as the obligation kind tells it. Each is told whatever else the month held, so a saving that went
 * into the living costs always has its line (R-WORLD-008).
 */
const CHORES: ReadonlySet<string> = new Set(
  Object.values(content.activity).flatMap((entry) => (entry?.effects.some((effect) => effect.type === "obligation/relief") === true ? [`line.obligation.relief.${entry.id.slice(entry.id.indexOf(".") + 1)}`] : [])),
);

/** A charge that fell due and could not be paid: no money moved, but the month went wrong (R-WORLD-008). */


/** True for a line that tells a bill not paid. */
export { isUnpaid };

/** A hunt that brought an offer, and the job offer it opens for the answer. */
const HIRED = "line.activity.hunt-hired";
const OPENED = "line.offer.opened";
const JOB_OFFER = "offer.job";

/**
 * The kiosk's draw (luck.md R-LUCK-005): a month a ticket was bought says what the
 * draw came to, won or not, never only the ticket's tag. Told whatever else the month held, as the chores are.
 */
const KIOSK_DRAW: ReadonlySet<string> = new Set(["line.activity.lotto-won", "line.activity.lotto-lost"]);

/** Someone who cares says cash on you is cash at risk (R-WALLET-019): told on the results, not left for News. */
const CASH_WARNING = "line.wallet.cash-warning";

/**
 * A bond that ended this month (people.md R-PEOPLE-035 to 042): told on the results, never left for News alone, so a
 * partner who stopped waiting or left is said the month it happens.
 */
export const BOND_ENDED: ReadonlySet<string> = new Set(["line.people.drifted", "line.people.left", "line.people.ended", "line.people.ended-absence", "line.people.ended-restart", "line.people.ended-block"]);

/** The visa granted: the month's news, told first and alone in the lead. */
const GRANTED = "line.route.granted";

/** The settlement cleared (docs/rules/home.md R-HOME-003), with cash lost or none: it leads the month, before anything else. */
const EVICTED: ReadonlySet<string> = new Set(["line.home.evicted", "line.home.evicted-no-cash"]);

/** True for the line that tells the room on the water is gone: first, and in the money's red as a bill unpaid is. */
export function isEvicted(line: ReportLine): boolean {
  return EVICTED.has(line.key);
}


/**
 * What the waiting months' acts came to (R-ACTIVITY-013): the exam's score, a piece for the portfolio,
 * open source's first merge or its quiet month, the raise or the month nobody said anything. Each is
 * told the month it happens, with the hunt's answer.
 */
const ACTS: ReadonlySet<string> = new Set([...EXAM_MARKED, PIECE, PIECE_MORE, "line.activity.first-merged", "line.activity.contributed", "line.activity.raised", "line.activity.not-noticed"]);

/** The set pieces an act's exam is sat in: once its score is told, "the exam is over" says nothing more. */
const EXAMS: ReadonlySet<string> = new Set(Object.values(content.activity).flatMap((entry) => (entry?.exam === undefined ? [] : [entry.exam.setpiece])));

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
  // R-PEOPLE-042: a bond that ended this month, before the month's errands.
  (line) => BOND_ENDED.has(line.key),
  // R-OBLIGATION-014: what cooking and fetching water saved on the upkeep, each its own line.
  (line) => ["line.activity.hunt-hired", "line.activity.hunt-missed", "line.activity.job-started", "line.activity.side-started", "line.offer.opened"].includes(line.key),
  (line) => ACTS.has(line.key),
  // The adviser's reading, paid for, leads the route's own lines.
  (line) => ["line.activity.adviser-missing", "line.activity.adviser-fits"].includes(line.key),
  (line) => line.key.startsWith("line.route."),
  (line) => (line.key.startsWith("line.document.") && line.key !== "line.document.already-pending") || line.key.startsWith("line.activity.driving-"),
  // R-WALLET-019: the warning about cash on you is told with the deposit that will be asked about.
  (line) => line.key === "line.wallet.flagged" || line.key === CASH_WARNING,
  (line) => line.key.startsWith("line.chapter.") || line.key.startsWith("line.goal.") || isSaid(line),
  (line) => line.key.startsWith("line.setpiece.") || line.key.startsWith("line.interview.") || line.key.startsWith("line.status."),
  forYou,
  // The kiosk's draw, after the month's events and before its chores.
  (line) => KIOSK_DRAW.has(line.key),
  // The month's chores (food cooked, water fetched) come after the month's events.
  (line) => line.key.startsWith("line.obligation.relief."),
];

function storyRank(line: ReportLine): number {
  return STORY.findIndex((matches) => matches(line));
}

/** The relative's gift answered says the flag and the way round it itself: the wallet's bare flag line is not told twice. */
const RELATIVE_SENDS = "offer.relative-sends";
function flagTold(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.key === "line.offer.taken" && line.params["offer"] === RELATIVE_SENDS);
}

/**
 * The month's story for the results (R-WORLD-008): the lines that move the story, not money, in
 * the order the results lead with them, at most `max` of the month's events (`STORY_MAX` unless the sheet has less room)
 * and then every chore. The rest of the month stays in News.
 */
export function storyLines(lines: readonly ReportLine[], max: number = STORY_MAX): ReportLine[] {
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
    // The cash warning is said once in a life with attention (R-WALLET-019): a full month never drops it.
    .filter((entry, at, ranked) => alwaysTold(entry.line) || ranked.slice(0, at).filter((before) => !alwaysTold(before.line)).length < max)
    .map((entry) => entry.line);
}

/** The month's pay as the results lead with it: the salary, the side job's pay (R-WORLD-008, the shrunk close). */
const PAYDAY: ReadonlySet<string> = new Set(["line.activity.salary", "line.wallet.salary", "line.activity.side-pay"]);
/** Rent paid as the month turns: a room's, a flat's, a bed space's. */
const RENT = "line.wallet.rent";

/** The most lines the month's close holds, Kept among them (12 Oct 2026: up to six lines). */
export const CLOSE_MAX = 6;
/** The fewest moments it keeps room for, however much pay and rent lead. */
const MOMENTS_MIN = 2;

/** The month's close as the results sheet tells it after Sleep: payday, rent when due, the moments, then Kept. */
export interface MonthClose {
  /** The pay that came in as the month turned, each its own line, money in. */
  payday: MoneyLine[];
  /** The rent taken as the month turned. */
  rent: MoneyLine[];
  /** The month's moments, in the story's order (the room cleared, the visa, a bill unpaid first), in the room left. */
  moments: ReportLine[];
}

/**
 * The month's close (R-WORLD-008): it leads with payday when there is one, then the rent
 * when it was due, then the moments, then Kept, in up to six lines. What was bought by hand during the month (food,
 * water, a fare) was paid as it was done and is not listed again; no living line, no "you rested". Only the lines of the
 * month's turn (`turned`) hold the pay and the rent; the story reads the whole month (`told`).
 */
export function monthClose(told: readonly ReportLine[], turned: readonly ReportLine[]): MonthClose {
  const money = moneyLines(turned);
  const payday = money.filter((entry) => PAYDAY.has(entry.line.key) && entry.sign === 1);
  const rent = money.filter((entry) => entry.line.key === RENT && entry.sign === -1);
  const room = Math.max(MOMENTS_MIN, CLOSE_MAX - 1 - payday.length - rent.length);
  return { payday, rent, moments: storyLines(told, room) };
}

/** The lines a full month never cuts: the chores, the cash warning, and the kiosk's draw. */
function alwaysTold(line: ReportLine): boolean {
  return CHORES.has(line.key) || line.key === CASH_WARNING || KIOSK_DRAW.has(line.key);
}

/** A route whose application has gone in: its papers no longer need warning of. */
const SENT: ReadonlySet<string> = new Set(["applying", "granted", "departed"]);

/**
 * The papers the plan's way out reads that run out within two months while its application is not sent (the thirteenth
 * review, Z10: the TB certificate ran out unseen, ₦120,000 gone): one line each on the results, the soonest first.
 */
export function runningOut(view: Pick<PlayerView, "documents" | "month" | "routes" | "plan" | "japacity" | "place">): { document: string; expiresMonth: number }[] {
  if (view.place.where !== "home") return [];
  const plan = view.plan.route ?? view.japacity.route;
  const route = view.routes.find((candidate) => candidate.id === plan);
  if (route === undefined || SENT.has(route.state)) return [];
  const reads = new Set((content.route[route.id]?.checklist ?? []).flatMap((item) => (item.requirement.type === "document/held" ? [item.requirement.document] : [])));
  return expiringSoon(view).flatMap(({ paper }) => (reads.has(paper.id) && paper.expiresMonth !== null ? [{ document: paper.id, expiresMonth: paper.expiresMonth }] : []));
}

/** True for the line that leads the results alone: the visa granted. */
export function leadsAlone(line: ReportLine): boolean {
  return line.key === GRANTED;
}

/** A change at the bank whose charge is too small to show: its `amount` is the charge, which stays money out with no line of its own. */
const CHARGE_RIDES: ReadonlySet<string> = new Set([CHANGED_SMALL]);
/** The sides of a change, told on their own lines and counted for nothing: a change is a move, not spending. */
const CHANGE_SIDES: ReadonlySet<string> = new Set([CHANGED, CHANGED_OUT, CHANGED_STREET, CHANGED_STREET_OUT, CHANGED_QUEUED, CONVERTED]);

/**
 * What was kept in each currency the lines moved: in less out, in the order each first appears. A change of money
 * counts for nothing either way (decision 0021 as amended, R-WORLD-008): its two sides are left out, and only the
 * bank's charge stays as money out, as the wallet counts the month (R-WALLET-015), counted once: its own line, or the
 * change's line when it is too small to show. An FX man's short count is its own line, money out.
 */
export function kept(lines: readonly MoneyLine[]): { currency: Currency; amount: number }[] {
  const order: Currency[] = [];
  const sums = new Map<Currency, number>();
  const add = (currency: Currency, amount: number): void => {
    if (!sums.has(currency)) order.push(currency);
    sums.set(currency, (sums.get(currency) ?? 0) + amount);
  };
  for (const { line, currency, sign, amount } of lines) {
    if (CHANGE_SIDES.has(line.key)) continue;
    if (CHARGE_RIDES.has(line.key)) {
      const charge = moneyParam("amount", line.params, line.key);
      if (charge !== null && charge.amount > 0) add(charge.currency, -charge.amount);
      continue;
    }
    add(currency, sign * amount);
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
 * How many tickets the player held in the Friday draw whose result this month's lines bring, when none of them won
 * (lottery.md R-LOTTERY-016); else null. The view's numbers are the last draw's
 * only while the next is on sale (R-LOTTERY-005: a closed draw being made holds the newer ones).
 */
export function drawMissed(view: Pick<PlayerView, "lottery">, lines: readonly ReportLine[]): number | null {
  const lottery = view.lottery;
  const shown = drawShown(view);
  if (lottery === null || shown === null || !lottery.onSale) return null;
  const mine = lottery.numbers ?? [];
  const drawn = lines.some((line) => (line.key === "line.lottery.drawn" || line.key === "line.lottery.drawn-rolled") && line.params["draw"] === shown.draw);
  return drawn && mine.length > 0 && shown.matched.length === 0 ? mine.length : null;
}

/** True for the whole view the Bank's figure reads; a test's slice takes the older path. */
function wholeView(view: Pick<PlayerView, "routes" | "japacity">): view is PlayerView {
  return ["plan", "pockets", "rates", "activities", "documents"].every((key) => key in view);
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
  // A whole view reads the Bank's own figure, so the two never disagree (R-WORLD-019).
  if (wholeView(view)) {
    const shared = savingsOf(view);
    if (shared !== null) return { kind: "funds", ...shared };
    return view.japacity.percent === null ? null : { kind: "percent", percent: view.japacity.percent };
  }
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

function toldQuiet(line: ReportLine, pays: PayView): ReportLine {
  const offer = line.params["offer"];
  if (line.key === OPENED && typeof offer === "string" && content.offer[offer as keyof typeof content.offer]?.news === false) return { ...line, key: QUIET_PASSED };
  return toldOnResults(line, pays);
}

/**
 * A quiet month of an Until news run as its one line (R-WORLD-028): what was kept in the money the
 * character lives on, and the one thing that moved: the month's first story line (a small ask passed
 * by told as such), else the credit file going up or down ("Kept £340. Credit up."), else nothing.
 */
export function quietLine(lines: readonly ReportLine[], local: Currency, pays: PayView): { kept: number | null; moved: ReportLine | null } {
  const money = moneyLines(lines);
  const net = kept(money).find((entry) => entry.currency === local);
  const [first] = storyLines(lines);
  const credit = lines.find((line) => CREDIT_MOVED.has(line.key));
  return { kept: money.length === 0 || net === undefined ? null : net.amount, moved: first !== undefined ? toldQuiet(first, pays) : (credit ?? null) };
}

/** A row the kiosk's tickets were told on: one ticket, or several bought at once. */
function isLotto(entry: MoneyLine): boolean {
  return entry.line.key === LOTTO_PAID || entry.line.key === LOTTO_TICKETS;
}

/** What came in from a change, at the bank or with the FX man: the side the results tell as the change. */
const CHANGE_IN: ReadonlySet<string> = new Set([CHANGED, CHANGED_SMALL, CHANGED_STREET]);

/**
 * The month's tickets in one row (R-TEXT-008: said once): every ticket bought at the kiosk this month, at whatever
 * visit, folded into the first row they were told on, with their money added. Only the telling folds; what was kept
 * still counts each line.
 */
export function foldLotto(lines: readonly MoneyLine[]): MoneyLine[] {
  const tickets = lines.filter(isLotto);
  if (tickets.length < 2) return [...lines];
  const amount = tickets.reduce((sum, entry) => sum + entry.amount, 0);
  const first = tickets[0]!;
  const folded: MoneyLine = { ...first, amount, line: { ...first.line, key: LOTTO_TICKETS, params: { ...first.line.params, amount: { currency: first.currency, amount } } } };
  return lines.flatMap((entry) => (entry === first ? [folded] : isLotto(entry) ? [] : [entry]));
}

/** The line under Kept for each change of money in the month (R-WORLD-008 as amended 11 Oct 2026). */
export const CHANGED_INTO = "ui.results.changed-into";

/** One change of money, both sides as they were: what was paid in (the bank's charge with it) and what came in. */
export interface ChangeInto {
  paid: MoneyParam;
  got: MoneyParam;
}

/**
 * Each change of money in the month, in the order made, both sides as they were (R-WORLD-008, amended 11 Oct 2026;
 * a change counts for nothing in the kept figure (decision 0021), so it is said under Kept
 * on its own line, "Changed ₦806,930 into £561", naira into pounds or dollars or back, at the bank or with the FX man.
 * A change whose foreign side waits in the bank's queue is told by its own line when paid in and is not one here, since
 * only one side is on the month's lines.
 */
export function changesInto(lines: readonly MoneyLine[]): ChangeInto[] {
  return lines.flatMap(({ line, sign }) => {
    if (!CHANGE_IN.has(line.key) || sign !== 1) return [];
    const paid = moneyParam("paid", line.params, line.key);
    const got = moneyParam("got", line.params, line.key);
    return paid === null || got === null || paid.amount === 0 || got.amount === 0 ? [] : [{ paid, got }];
  });
}

/** A tag under what was kept: what moved the month, as a sign and a few words (R-TEXT-008). */
export interface MonthTag {
  id: "lotto";
  tone: "up" | "down" | "plain";
  key: string;
  amount: { currency: Currency; amount: number };
}

/**
 * The tags that say what the kept figure holds (R-WORLD-008, R-TEXT-008): the lotto, down, the month's tickets
 * together. A change of money is said by its own line under Kept instead (`changesInto`), never twice.
 */
export function monthTags(lines: readonly MoneyLine[]): MonthTag[] {
  const tags: MonthTag[] = [];
  const tickets = lines.filter(isLotto);
  if (tickets.length > 0) tags.push({ id: "lotto", tone: "down", key: "ui.results.tag.lotto", amount: { currency: tickets[0]!.currency, amount: tickets.reduce((sum, entry) => sum + entry.amount, 0) } });
  return tags;
}
