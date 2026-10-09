// What the results sheet reads from the view (docs/rules/world.md R-WORLD-008): the month's money
// lines with their signs, what was kept, the draw's numbers with any of the player's lit, and the
// savings toward the move. Plain functions over the view, so the sheet only lays them out.
import { content } from "@japacity/content";
import type { Currency, PlayerView, ReportLine } from "@japacity/sim";

import { movesMoney, tidyLines } from "../../shared/words/lines";
import { moneyParam } from "../../shared/words/text";

export interface MoneyLine {
  line: ReportLine;
  /** In (1) or out (-1). */
  sign: 1 | -1;
  currency: Currency;
  amount: number;
}

/** Lines that carry an amount and a tone but move no money: a deposit flagged is a warning, not a flow. */
const NOT_MOVED: ReadonlySet<string> = new Set(["line.wallet.flagged"]);

/**
 * The lines in or out, in the simulation's order, one line for each payment as the report reads
 * them. A good line with an amount is money in, a bad one money out; a plain line (a conversion,
 * a move between pockets) moves nothing the player keeps or loses. Only a line that tells money
 * moving counts: a bill that could not be paid, or a scam told after its fee, is not money gone
 * twice (R-WORLD-008).
 */
export function moneyLines(lines: readonly ReportLine[]): MoneyLine[] {
  return tidyLines(lines).flatMap((line): MoneyLine[] => {
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

/** What was kept in each currency the lines moved: in less out, in the order each first appears. */
export function kept(lines: readonly MoneyLine[]): { currency: Currency; amount: number }[] {
  const order: Currency[] = [];
  const sums = new Map<Currency, number>();
  for (const { currency, sign, amount } of lines) {
    if (!sums.has(currency)) order.push(currency);
    sums.set(currency, (sums.get(currency) ?? 0) + sign * amount);
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
