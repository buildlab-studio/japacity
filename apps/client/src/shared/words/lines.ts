// A month's lines as the player reads them: one line for each payment. The
// simulation tells each pocket and each kind its own line; the screen folds a
// payment split across pockets into one total, and drops the second telling of
// a payment another line already names.
import { content, text } from "@japacity/content";
import type { MoneyParam, ReportLine } from "@japacity/sim";

import { bandResultLine } from "./englishTest";
import { hasWords, moneyParam } from "./text";

const WALLET = "line.wallet.";

/** A story reaching the player: never something to answer, even when it is for you. */
const NEWS = "line.news.delivered";

/** The prologue's years are told, never asked: its lines (the degree graded) need nothing of the player. */
const PROLOGUE_TOLD = ["line.prologue.", "prologue.line."];

/** True when the line waits on the player. A news story never does; one for you is marked as for you instead. */
export function asksAttention(line: ReportLine): boolean {
  return line.attention && line.key !== NEWS && !PROLOGUE_TOLD.some((told) => line.key.startsWith(told));
}

/** True for a news story about the player's own plans. */
export function forYou(line: ReportLine): boolean {
  return line.key === NEWS && line.params.forYou === 1;
}

/** A line that says the same payment better, and the plain wallet line it makes redundant. */
const SAID_BETTER: readonly [better: string, plain: string][] = [
  ["line.activity.salary", "line.wallet.salary"],
  ["line.activity.gig", "line.wallet.gig"],
  // advice:bad-news-told-straight: the scam names the agent and says the fee is gone; the wallet's fee line is the same money.
  ["line.offer.agent-scam", "line.wallet.fee-agent"],
  // luck:savings-circle-holds-pot: the circle's pot lands as a gift in the wallet; the pot's own line says whose money it is.
  ["line.obligation.pot", "line.wallet.gift"],
];

/**
 * Wallet lines whose money never reaches the naira the player sees: held funds sit locked from the
 * day they land to the day they go back (obligation:missed-interest-recalls-held-funds), so neither end is kept or lost.
 */
const LOCKED_ONLY: ReadonlySet<string> = new Set(["line.wallet.held-funds", "line.wallet.held-funds-return"]);

/** A family request's payment, named for what it paid (see `paidFor`): still the wallet's money moving. */
const FAMILY_PAID = "ui.line.family-paid.";

/** Any other answer's money, named for the offer that moved it (see `paidFor`): a thirteenth month is not a second salary. */
const OFFER_PAID = "ui.line.offer-paid.";

/** A bill's payment, named for the bill when the wallet's reason says it wrong (see `paidAs`): a savings circle is not going out. */
const CHARGED_AS = "ui.line.charged.";

/** An activity's spending, named for the activity that spent it (see `activityPaid`): a meetup is not just going out. */
const ACTIVITY_PAID = "ui.line.activity-paid.";

/** The living costs charged at a new figure, said as the rise and its reason (see `upkeepMoved`). */
const UPKEEP_MOVED = "ui.line.upkeep-";

/** The naira leg of money sent home, named for where it lands. */
const REMIT_LANDED = "ui.line.remit-landed";

/** The move to a home with rent, said as the move with what it costs a month (see `movedWithRent`). */
const HOME_MOVED_RENT = "ui.line.home-moved";

/** The interface's names for a payment: the wallet's money moving, said for what it paid. */
const NAMED: readonly string[] = [FAMILY_PAID, OFFER_PAID, CHARGED_AS, "ui.line.document-fee", REMIT_LANDED, ACTIVITY_PAID, UPKEEP_MOVED, HOME_MOVED_RENT];

/** The prologue's last line: what came before it is the years before the first month. */
export const PROLOGUE_CLOSED = "line.prologue.closed";

/** The prologue's earnings, said as what the character brings into the first month. */
const SAVINGS_BEFORE = "ui.line.savings-before";

/**
 * True for a line that tells money moving: the wallet's own lines, which tell every payment in or
 * out, and the lines that say one of them better. Any other line with an amount (a bill missed, a
 * debt in default) tells of money without moving it, and neither does money that only sits locked
 * or was saved in the years before the first month (world:month-end-results-sheet).
 */
export function movesMoney(line: ReportLine): boolean {
  if (LOCKED_ONLY.has(line.key)) return false;
  return line.key.startsWith(WALLET) || NAMED.some((named) => line.key.startsWith(named)) || SAID_BETTER.some(([better]) => toldAs(line.key, better));
}

/**
 * True for `base` and for its words of its own (`<base>.<what>`, see `variant`): the same payment told for this job or this
 * month, as the catch's share and the kiln's takings are, still the money the plain line would have counted.
 */
export function toldAs(key: string, base: string): boolean {
  return key === base || key.startsWith(`${base}.`);
}

/** The lines told after the prologue closed: the month itself. All of them when there was no prologue. */
export function afterPrologue(lines: readonly ReportLine[]): ReportLine[] {
  const closed = lines.findLastIndex((line) => line.key === PROLOGUE_CLOSED);
  return closed === -1 ? [...lines] : lines.slice(closed + 1);
}

/** An obligation's charge repeats the wallet line that paid it, which names the spending better. */
const CHARGED = "line.obligation.charged";

function moneyOf(line: ReportLine): MoneyParam | null {
  return moneyParam("amount", line.params, line.key);
}

function sameMoney(a: MoneyParam | null, b: MoneyParam | null): boolean {
  return a !== null && b !== null && a.currency === b.currency && a.amount === b.amount;
}

/** True when two lines differ only in their amount: one payment taken from two pockets. */
function samePayment(a: ReportLine, b: ReportLine): boolean {
  if (a.key !== b.key || !a.key.startsWith(WALLET) || a.attention || b.attention || a.tone !== b.tone) return false;
  const left = moneyOf(a);
  const right = moneyOf(b);
  if (left === null || right === null || left.currency !== right.currency) return false;
  const names = new Set([...Object.keys(a.params), ...Object.keys(b.params)]);
  names.delete("amount");
  return [...names].every((name) => a.params[name] === b.params[name]);
}

function withAmount(line: ReportLine, amount: number): ReportLine {
  const given = line.params.amount;
  const next = typeof given === "object" ? { ...given, amount } : amount;
  return { ...line, params: { ...line.params, amount: next } };
}

function foldPockets(lines: readonly ReportLine[]): ReportLine[] {
  const folded: ReportLine[] = [];
  for (const line of lines) {
    const last = folded.at(-1);
    if (last !== undefined && samePayment(last, line)) {
      folded[folded.length - 1] = withAmount(last, (moneyOf(last)?.amount ?? 0) + (moneyOf(line)?.amount ?? 0));
    } else folded.push(line);
  }
  return folded;
}

function dropRetold(lines: readonly ReportLine[]): ReportLine[] {
  const dropped = new Set<number>();
  const take = (index: number) => {
    if (index >= 0) dropped.add(index);
  };
  lines.forEach((line, index) => {
    for (const [better, plain] of SAID_BETTER) {
      if (line.key !== better) continue;
      take(lines.findIndex((other, at) => !dropped.has(at) && other.key === plain && sameMoney(moneyOf(other), moneyOf(line))));
    }
    if (line.key === CHARGED) {
      const paid = lines.some((other) => (other.key.startsWith(WALLET) || other.key.startsWith(CHARGED_AS)) && other.tone === "bad" && sameMoney(moneyOf(other), moneyOf(line)));
      if (paid) take(index);
    }
  });
  return lines.filter((_, index) => !dropped.has(index));
}

/** Where content has an offer's own words for one answer, `<offer>.said.<choice>` (chapter:family-marks-the-grant). */
const SAID = ".said.";

/** True for an answer to an offer told in the offer's own words. */
export function isSaid(line: ReportLine): boolean {
  return line.key.startsWith("offer.") && line.key.includes(SAID);
}

/** An offer answered, or lapsed into a choice, told in the offer's words for that choice when content has them. */
function saidFor(line: ReportLine): string | null {
  if (line.key !== TAKEN && line.key !== LAPSED) return null;
  const { offer, choice } = line.params;
  if (typeof offer !== "string" || typeof choice !== "string") return null;
  const key = `${offer}${SAID}${choice}`;
  return hasWords(key) ? key : null;
}

/**
 * A paper asked for whose answer is still to be judged (the endorsement, route-gates:endorsement-decided-by-draw) is told in its own words,
 * `<document>.requested`, who answers and when, never "should be ready" (world:month-end-results-sheet).
 */
function requestedFor(line: ReportLine): string | null {
  const { document } = line.params;
  if (line.key !== REQUESTED || typeof document !== "string") return null;
  return hasWords(`${document}.requested`) ? `${document}.requested` : null;
}

/** A line whose words read wrong for its figures gets the interface's variant. */
function variant(line: ReportLine): ReportLine {
  const said = saidFor(line) ?? requestedFor(line);
  if (said !== null) return { ...line, key: said };
  // activity:boat-work-at-the-net-shed, activity:watch-the-match: a place's answer with its own words for this time says them.
  const told = line.params["variant"];
  if (line.key.startsWith("line.activity.") && line.key.endsWith(".now") && typeof told === "string" && hasWords(`${line.key}.${told}`)) return { ...line, key: `${line.key}.${told}` };
  // activity:catch-drawn-each-month: a boat rung's pay leads with the catch's word.
  const caught = line.params["catch"];
  if (line.key === "line.activity.salary" && typeof caught === "string" && hasWords(`${line.key}.catch.${caught}`)) return { ...line, key: `${line.key}.catch.${caught}` };
  // A job with its own words for its pay says them: the stall's takings are not a salary.
  const job = line.params["job"];
  if (line.key === "line.activity.salary" && typeof job === "string" && hasWords(`${line.key}.${job}`)) return { ...line, key: `${line.key}.${job}` };
  if (line.key === "line.route.school-offer") {
    const discount = moneyParam("discount", line.params, line.key);
    if (discount !== null && discount.amount === 0) return { ...line, key: "ui.line.school-offer-plain" };
  }
  // The English result under the band the route needs says so and what next.
  return bandResultLine(line);
}

/** Money earned in the prologue's years is what the character brings to the first month, not pay for this one. */
function savedBefore(lines: readonly ReportLine[]): ReportLine[] {
  const closed = lines.findLastIndex((line) => line.key === PROLOGUE_CLOSED);
  // The years' gigs are one sum brought to the first month, said once.
  const before = lines.filter((line, index) => index < closed && line.key === "line.wallet.gig");
  if (before.length === 0) return [...lines];
  const first = before[0];
  if (first === undefined) return [...lines];
  const total = before.reduce((sum, line) => sum + (moneyOf(line)?.amount ?? 0), 0);
  const money = first.params["amount"];
  const amount = typeof money === "object" && money !== null ? { ...money, amount: total } : total;
  const summed: ReportLine = { ...first, key: SAVINGS_BEFORE, params: { ...first.params, amount } };
  let told = false;
  return lines.flatMap((line, index) => {
    if (!(index < closed && line.key === "line.wallet.gig")) return [line];
    if (told) return [];
    told = true;
    return [summed];
  });
}

const FAMILY = "line.wallet.family";
const TAKEN = "line.offer.taken";
const LAPSED = "line.offer.lapsed";

/**
 * True for the place's answer to an act done at once, the last of its lines (activity:now-acts-and-month-acts): money
 * before it is the act's, and an offer answered after it is another command whose money comes after.
 */
function endsAct(line: ReportLine): boolean {
  return line.key.startsWith("line.activity.") && line.key.endsWith(".now");
}

/**
 * Money an answer moved, said as what it was for, from the answer the offer's line gives after it:
 * a family request as what it paid for ("The NEPA bill"), and any other offer with words for its
 * money as that offer ("A thirteenth month's pay"), so it never reads as the month's own salary
 * told twice. A payment the interface has no words for keeps the wallet's.
 */
function paidFor(lines: readonly ReportLine[]): ReportLine[] {
  return lines.map((line, index) => {
    if (!line.key.startsWith(WALLET)) return line;
    const later = lines.slice(index + 1);
    const next = later.find((other) => other.key === TAKEN || other.key.startsWith(WALLET) || endsAct(other));
    const reason = line.key.slice(WALLET.length);
    if (next?.key !== TAKEN) return withMoneyAfter(line, later);
    const { offer } = next.params;
    if (typeof offer !== "string") return line;
    // The answer's own words for this payment by its reason, where content has them, before its words for any payment
    // (the prize message's fee is not money "paid to the agent").
    const keys = line.key === FAMILY ? [`${FAMILY_PAID}${offer}`] : [`${OFFER_PAID}${offer}.${reason}`, `${OFFER_PAID}${offer}`];
    const key = keys.find(hasWords);
    return key === undefined ? line : { ...line, key };
  });
}

/**
 * A payment an answer moved before more of the answer's money (the prize message answered honestly: the fee, then the
 * prize): said by the answer's words for that payment with the money after it, `<offer>.<reason>.then-<reason>`, where
 * content has them; any other keeps the wallet's words. Only the wallet's lines may stand between it and the answer.
 */
function withMoneyAfter(line: ReportLine, later: readonly ReportLine[]): ReportLine {
  const close = later.findIndex((other) => !other.key.startsWith(WALLET));
  const taken = close < 1 ? undefined : later[close];
  const offer = taken?.key === TAKEN ? taken.params.offer : undefined;
  const after = later[0]?.key.slice(WALLET.length);
  if (typeof offer !== "string" || after === undefined) return line;
  const key = `${OFFER_PAID}${offer}.${line.key.slice(WALLET.length)}.then-${after}`;
  return hasWords(key) ? { ...line, key } : line;
}

/**
 * A bill's payment said as the bill, where the wallet's reason names it wrong: the wallet tells a
 * share paid into the savings circle by its sink, going out; the bill's own line just after it says
 * which bill it was, as the NEPA bill is named for what it paid.
 */
function paidAs(lines: readonly ReportLine[]): ReportLine[] {
  return lines.map((line, index) => {
    const next = lines[index + 1];
    if (!line.key.startsWith(WALLET) || line.tone !== "bad" || next?.key !== CHARGED || !sameMoney(moneyOf(line), moneyOf(next))) return line;
    const { obligation } = next.params;
    const key = typeof obligation === "string" ? `${CHARGED_AS}${obligation}` : null;
    return key !== null && hasWords(key) ? { ...line, key } : line;
  });
}

/** A paper's fee and the paper asked for just after it. */
const DOCUMENT_FEE = "line.wallet.fee-document";
const REQUESTED = "line.document.requested";
const PAPER_FEE = "ui.line.document-fee";

/** A paper's fee said as that paper's ("The transcript's fee"), not as money paid at some office. */
function paperFee(lines: readonly ReportLine[]): ReportLine[] {
  return lines.map((line, index) => {
    const next = lines[index + 1];
    const document = next?.key === REQUESTED ? next.params.document : undefined;
    return line.key === DOCUMENT_FEE && typeof document === "string" ? { ...line, key: PAPER_FEE, params: { ...line.params, document } } : line;
  });
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

/** A charge that fell due and could not be paid: no money moved, but the month went wrong (world:month-end-results-sheet). */
const UNPAID: ReadonlySet<string> = new Set([
  "line.obligation.missed",
  "line.obligation.missed-part",
  "line.obligation.car-notice",
  "line.obligation.group-visit",
  "line.obligation.group-covered",
  // abroad-money:missed-tuition-runs-in-stages: a tuition charge missed is told by the fees office's letter for its stage.
  "line.obligation.tuition-reminder",
  "line.obligation.tuition-cut",
  "line.obligation.tuition-warning",
]);

export function isUnpaid(line: ReportLine): boolean {
  return UNPAID.has(line.key);
}

/**
 * A bill missed, told with its figure and what the miss cost (world:month-end-results-sheet): the generic "standing and mood"
 * line is false for a tuition instalment, whose miss costs nothing at once.
 * The results and the News app tell it the same way.
 */
export function toldUnpaid(line: ReportLine): ReportLine {
  const { obligation } = line.params;
  if (typeof obligation !== "string") return line;
  if (line.key === "line.obligation.missed-part") return { ...line, key: `ui.results.unpaid-part.${unpaidCost(obligation)}` };
  if (line.key !== "line.obligation.missed") return line;
  return { ...line, key: `ui.results.unpaid.${unpaidCost(obligation)}` };
}

export function tidyLines(lines: readonly ReportLine[]): ReportLine[] {
  // Named before the retold go, so a payment named for its offer is never taken for the month's own.
  return toldMoves(readyNotOnTheWay(oneGoalLine(jobEndsWithFlight(movedWithRent(upkeepMoved(oneEndorsementStory(savedBefore(dropRetold(paperFee(activityPaid(paidAs(paidFor(foldPockets(lines)))))))))))))).map(variant).map(remitLanded).map(goalFirst);
}

/** The lines that tell a quality's move. */
const MOVES: ReadonlySet<string> = new Set(["line.quality.gain", "line.quality.loss", "line.quality.worn", "line.quality.drift"]);
/** The portfolio's gain is told as a piece for it (told.ts, `asPiece`), so it is never folded into its act's line. */
const PIECES = "quality.portfolio";
/**
 * Causes whose own line already says what they did to the person: the free time rested ("You rested when you had the
 * time", the source `rest`), the rest planned, the talk and how it went.
 */
const TOLD_BY_OWN_LINE: ReadonlySet<string> = new Set(["rest", "activity.rest", "activity.conference-talk"]);

/**
 * What an act did to the person, told once (text:bands-not-figures): the moves a line's `source` caused
 * are one line in the act's own words where content has them (`line.quality.from.<source>`: "You know more people at
 * the hub now" for the meetup's network and wellbeing), and none at all where the act's own line already says it (an
 * offer answered in its own words, the rest taken, the talk). Any other move is told by its quality (text.ts, `words`).
 */
function toldMoves(lines: readonly ReportLine[]): ReportLine[] {
  const said = new Set(lines.flatMap((line) => {
    const { offer, choice } = line.params;
    return saidFor(line) === null || typeof offer !== "string" || typeof choice !== "string" ? [] : [`${offer}.${choice}`];
  }));
  const folded = new Set<string>();
  const isMove = (line: ReportLine): boolean => MOVES.has(line.key) && line.params.quality !== PIECES;
  return lines.flatMap((line) => {
    const source = line.params.source;
    if (!isMove(line) || typeof source !== "string") return [line];
    if (TOLD_BY_OWN_LINE.has(source) || said.has(source)) return [];
    const own = `line.quality.from.${source}`;
    if (!hasWords(own)) return [line];
    if (folded.has(source)) return [];
    folded.add(source);
    const tones = new Set(lines.filter((other) => isMove(other) && other.params.source === source).map((other) => other.tone));
    return [{ ...line, key: own, params: {}, tone: tones.size === 1 ? line.tone : "plain" }];
  });
}

/** A slot played, and a now-act done at once (activity:now-acts-and-month-acts): each comes just before the money it spent. */
const PLAYED: ReadonlySet<string> = new Set(["line.activity.played", "line.activity.played-now"]);

/**
 * Money an activity spent, said as that activity where the interface has words for it: the meetup's
 * cost is "The meetup", not "Spent going out". The activity's played line
 * comes just before the money it spent.
 */
function activityPaid(lines: readonly ReportLine[]): ReportLine[] {
  return lines.map((line, index) => {
    const before = lines[index - 1];
    const activity = before !== undefined && PLAYED.has(before.key) ? before.params.activity : undefined;
    if (!line.key.startsWith(WALLET) || line.tone !== "bad" || typeof activity !== "string") return line;
    const key = `${ACTIVITY_PAID}${activity}`;
    return hasWords(key) ? { ...line, key } : line;
  });
}

const UPKEEP = "line.wallet.upkeep";
const HOME_MOVED = "line.home.moved";
const NEWS_DELIVERED = "line.news.delivered";
const INFLATION = "var.inflation";

/** How a story moves the living costs at home when it comes into force: up, down, or not at all. */
function inflationMove(story: string): "up" | "down" | null {
  const entry = content.news[story as keyof typeof content.news];
  if (entry === undefined) return null;
  const moves = [...(entry.director?.adds ?? []), ...entry.standIn.sets].filter((change) => change.var === INFLATION).map((change) => change.value);
  if (moves.length === 0) return null;
  return moves.reduce((sum, value) => sum + value, 0) >= 0 ? "up" : "down";
}

/**
 * The month the living costs at home are first charged at a new figure says so, with the reason:
 * the story that moved prices comes into force in the same month's lines,
 * and the charge it moved is that month's living costs. Told on the living costs' own line, so the
 * figure stays in the money.
 */
function upkeepMoved(lines: readonly ReportLine[]): ReportLine[] {
  // A move this month explains the new figure itself (line.home.moved); a story's note would misread it.
  if (lines.some((line) => line.key === HOME_MOVED)) return [...lines];
  const story = lines.find((line) => line.key === NEWS_DELIVERED && line.params.stage === "in-force" && typeof line.params.story === "string" && inflationMove(line.params.story) !== null)?.params.story;
  if (typeof story !== "string") return [...lines];
  const way = inflationMove(story);
  const at = lines.findIndex((line) => line.key === UPKEEP && moneyOf(line)?.currency === "NGN");
  if (way === null || at === -1) return [...lines];
  const told = hasWords(`${UPKEEP_MOVED}${way}.${story}`) ? `${UPKEEP_MOVED}${way}.${story}` : `${UPKEEP_MOVED}${way}`;
  return lines.map((line, index) => (index === at ? { ...line, key: told } : line));
}

/** The room's first charge met by the rent paid on the move (home:move-home-once-a-month): the move's line told it already. */
const MOVE_PAID = "line.obligation.relief.move";

/**
 * A move to a home with rent is one line with the rent it paid (home:move-home-once-a-month): "Home is Makoko
 * now: ₦25,000 a month." in the money, in place of the move's own line and a "Living costs" beside it. The rent comes
 * just after the move made from the phone, or just before it when an answer paid it. The month's end says nothing
 * more of it: that charge was met on the move.
 */
function movedWithRent(lines: readonly ReportLine[]): ReportLine[] {
  const paid = new Map<number, number>();
  lines.forEach((line, index) => {
    if (line.key !== HOME_MOVED) return;
    const at = [index + 1, index - 1].find((near) => {
      const rent = lines[near];
      return rent !== undefined && rent.key === UPKEEP && rent.tone === "bad" && moneyOf(rent)?.currency === "NGN" && ![...paid.values()].includes(near);
    });
    if (at !== undefined) paid.set(index, at);
  });
  const rents = new Set(paid.values());
  return lines.flatMap((line, index): ReportLine[] => {
    if (line.key === MOVE_PAID || rents.has(index)) return [];
    const at = paid.get(index);
    const rent = at === undefined ? undefined : lines[at];
    return rent === undefined ? [line] : [{ ...rent, key: HOME_MOVED_RENT, params: { ...rent.params, place: line.params["place"] ?? "" } }];
  });
}

const DEPARTED = "line.route.departed";
const JOB_ENDED = "line.activity.job-ended";
/** The job at home that ends with the flight, told beside the plane. */
const JOB_ENDS_WITH_FLIGHT = "line.route.departed-job-ended";

/** A job held at home ends the month the plane leaves: told right after the flight, as part of it, not only in News. */
function jobEndsWithFlight(lines: readonly ReportLine[]): ReportLine[] {
  const departed = lines.findIndex((line) => line.key === DEPARTED);
  if (departed === -1 || !lines.some((line) => line.key === JOB_ENDED)) return [...lines];
  const ended = lines.filter((line) => line.key === JOB_ENDED).map((line) => ({ ...line, key: JOB_ENDS_WITH_FLIGHT }));
  const rest = lines.filter((line) => line.key !== JOB_ENDED);
  const at = rest.findIndex((line) => line.key === DEPARTED);
  return [...rest.slice(0, at + 1), ...ended, ...rest.slice(at + 1)];
}

const ISSUED = "line.document.issued";

/**
 * A paper asked for and issued in the same month is told once, as ready: never "on the way, ready this month" beside
 * "ready", a test's band out among them (never "It should be ready this month." beside "Your
 * English test result is out.").
 */
function readyNotOnTheWay(lines: readonly ReportLine[]): ReportLine[] {
  const ready = new Set(lines.filter((line) => line.key === ISSUED || line.key.startsWith(`${ISSUED}-band`)).map((line) => line.params["document"]));
  return lines.filter((line) => !(line.key === REQUESTED && ready.has(line.params["document"])));
}

const GOAL_OPENED = "line.goal.opened";
const GOAL_DONE = "line.goal.done";

/** A goal opened and reached in the same month is told once, as reached. */
function oneGoalLine(lines: readonly ReportLine[]): ReportLine[] {
  const reached = new Set(lines.filter((line) => line.key === GOAL_DONE).map((line) => line.params.goal));
  return lines.filter((line) => !(line.key === GOAL_OPENED && reached.has(line.params.goal)));
}

/** A goal opened names its first act when content has one (`goal.<id>.first`). */
const GOAL_FIRST = "ui.line.goal-first";
function goalFirst(line: ReportLine): ReportLine {
  const goal = line.params["goal"];
  if (line.key !== GOAL_OPENED || typeof goal !== "string" || !hasWords(`${goal}.first`)) return line;
  return { ...line, key: GOAL_FIRST, params: { ...line.params, first: text[`${goal}.first`] ?? "" } };
}

/** Money sent home lands in the naira account at home: that leg says so, instead of "sent home" twice. */
function remitLanded(line: ReportLine): ReportLine {
  const money = moneyParam("amount", line.params, line.key);
  return line.key === "line.wallet.remit" && money?.currency === "NGN" ? { ...line, key: REMIT_LANDED } : line;
}

/**
 * An endorsement judged the month it is issued (route-gates:endorsement-decided-by-draw) tells four lines at once: ready, the body's
 * refusal, a visa refused for a route never applied for, and the letter voided. One story is enough: the
 * body's refusal stands; the ready line, the refusal noted on the route and the voiding go.
 */
function oneEndorsementStory(lines: readonly ReportLine[]): ReportLine[] {
  const refusedBody = lines.filter((line) => line.key === "line.route.endorsement-refused");
  if (refusedBody.length === 0) return [...lines];
  const paper = (line: ReportLine): string | null => (typeof line.params["document"] === "string" ? line.params["document"] : null);
  const voided = new Set(lines.filter((line) => line.key === "line.document.voided").map(paper));
  return lines.filter((line) => {
    if (line.key === "line.route.refused" && line.params["reason"] === "endorsement") return false;
    if (line.key === "line.document.voided") return false;
    if (line.key === "line.document.issued" && voided.has(paper(line))) return false;
    return true;
  });
}
