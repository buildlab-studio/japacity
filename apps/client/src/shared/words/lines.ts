// A month's lines as the player reads them: one line for each payment. The
// simulation tells each pocket and each kind its own line; the screen folds a
// payment split across pockets into one total, and drops the second telling of
// a payment another line already names.
import type { MoneyParam, ReportLine } from "@japacity/sim";

import { moneyParam } from "./text";

const WALLET = "line.wallet.";

/** A story reaching the player: never something to answer, even when it is for you. */
const NEWS = "line.news.delivered";

/** True when the line waits on the player. A news story never does; one for you is marked as for you instead. */
export function asksAttention(line: ReportLine): boolean {
  return line.attention && line.key !== NEWS;
}

/** True for a news story about the player's own plans. */
export function forYou(line: ReportLine): boolean {
  return line.key === NEWS && line.params.forYou === 1;
}

/** A line that says the same payment better, and the plain wallet line it makes redundant. */
const SAID_BETTER: readonly [better: string, plain: string][] = [
  ["line.activity.salary", "line.wallet.salary"],
  ["line.activity.gig", "line.wallet.gig"],
];

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
      const paid = lines.some((other) => other.key.startsWith(WALLET) && other.tone === "bad" && sameMoney(moneyOf(other), moneyOf(line)));
      if (paid) take(index);
    }
  });
  return lines.filter((_, index) => !dropped.has(index));
}

/** A line whose words read wrong for its figures gets the interface's variant. */
function variant(line: ReportLine): ReportLine {
  if (line.key === "line.route.school-offer") {
    const discount = moneyParam("discount", line.params, line.key);
    if (discount !== null && discount.amount === 0) return { ...line, key: "ui.line.school-offer-plain" };
  }
  return line;
}

export function tidyLines(lines: readonly ReportLine[]): ReportLine[] {
  return dropRetold(foldPockets(lines)).map(variant);
}
