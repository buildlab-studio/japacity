// A month's lines as the player reads them: one line for each payment. The
// simulation tells each pocket and each kind its own line; the screen folds a
// payment split across pockets into one total, and drops the second telling of
// a payment another line already names.
import type { MoneyParam, ReportLine } from "@japacity/sim";

import { bandResultLine } from "./test";
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
  // R-ADVICE-009: the scam names the agent and says the fee is gone; the wallet's fee line is the same money.
  ["line.offer.agent-scam", "line.wallet.fee-agent"],
  // R-LUCK-009: the circle's pot lands as a gift in the wallet; the pot's own line says whose money it is.
  ["line.obligation.pot", "line.wallet.gift"],
];

/**
 * Wallet lines whose money never reaches the naira the player sees: held funds sit locked from the
 * day they land to the day they go back (R-OBLIGATION-007), so neither end is kept or lost.
 */
const LOCKED_ONLY: ReadonlySet<string> = new Set(["line.wallet.held-funds", "line.wallet.held-funds-return"]);

/** A family request's payment, named for what it paid (see `paidFor`): still the wallet's money moving. */
const FAMILY_PAID = "ui.line.family-paid.";

/** Any other answer's money, named for the offer that moved it (see `paidFor`): a thirteenth month is not a second salary. */
const OFFER_PAID = "ui.line.offer-paid.";

/** A bill's payment, named for the bill when the wallet's reason says it wrong (see `paidAs`): a savings circle is not going out. */
const CHARGED_AS = "ui.line.charged.";

/** The interface's names for a payment: the wallet's money moving, said for what it paid. */
const NAMED: readonly string[] = [FAMILY_PAID, OFFER_PAID, CHARGED_AS, "ui.line.document-fee"];

/** The prologue's last line: what came before it is the years before the first month. */
export const PROLOGUE_CLOSED = "line.prologue.closed";

/** The prologue's earnings, said as what the character brings into the first month. */
const SAVINGS_BEFORE = "ui.line.savings-before";

/**
 * True for a line that tells money moving: the wallet's own lines, which tell every payment in or
 * out, and the lines that say one of them better. Any other line with an amount (a bill missed, a
 * debt in default) tells of money without moving it, and neither does money that only sits locked
 * or was saved in the years before the first month (R-WORLD-008).
 */
export function movesMoney(line: ReportLine): boolean {
  if (LOCKED_ONLY.has(line.key)) return false;
  return line.key.startsWith(WALLET) || NAMED.some((named) => line.key.startsWith(named)) || SAID_BETTER.some(([better]) => better === line.key);
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

/** Where content has an offer's own words for one answer, `<offer>.said.<choice>` (R-CHAPTER-008). */
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

/** A line whose words read wrong for its figures gets the interface's variant. */
function variant(line: ReportLine): ReportLine {
  const said = saidFor(line);
  if (said !== null) return { ...line, key: said };
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
  return lines.map((line, index) => (index < closed && line.key === "line.wallet.gig" ? { ...line, key: SAVINGS_BEFORE } : line));
}

const FAMILY = "line.wallet.family";
const TAKEN = "line.offer.taken";
const LAPSED = "line.offer.lapsed";

/**
 * Money an answer moved, said as what it was for, from the answer the offer's line gives after it:
 * a family request as what it paid for ("The NEPA bill"), and any other offer with words for its
 * money as that offer ("A thirteenth month's pay"), so it never reads as the month's own salary
 * told twice. A payment the interface has no words for keeps the wallet's.
 */
function paidFor(lines: readonly ReportLine[]): ReportLine[] {
  return lines.map((line, index) => {
    if (!line.key.startsWith(WALLET)) return line;
    const next = lines.slice(index + 1).find((other) => other.key === TAKEN || other.key.startsWith(WALLET));
    const offer = next?.key === TAKEN ? next.params.offer : undefined;
    if (typeof offer !== "string") return line;
    const key = line.key === FAMILY ? `${FAMILY_PAID}${offer}` : `${OFFER_PAID}${offer}`;
    return hasWords(key) ? { ...line, key } : line;
  });
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

export function tidyLines(lines: readonly ReportLine[]): ReportLine[] {
  // Named before the retold go, so a payment named for its offer is never taken for the month's own.
  return oneEndorsementStory(savedBefore(dropRetold(paperFee(paidAs(paidFor(foldPockets(lines))))))).map(variant);
}

/**
 * An endorsement judged the month it is issued (R-ENDORSE-002) tells four lines at once: ready, the body's
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
