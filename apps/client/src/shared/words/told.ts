// How the month's lines are told, on the results and in News alike (docs/rules/world.md R-WORLD-008): a piece for the portfolio counted as a piece, a score or a count said in words, a bill missed with what it
// cost, a hunt's answer with the job and its pay. In shared/ so the results and the phone's News read one telling.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";

import { monthlyPayOf } from "./cost";
import { countWords } from "./count";
import { isUnpaid, tidyLines, toldUnpaid } from "./lines";

/** A piece added to the portfolio, as the results tell the portfolio's own line. */
export const PIECE = "line.activity.piece-built";
export const PIECE_MORE = "line.activity.piece-built-more";
const PORTFOLIO = "quality.portfolio";

/** The exam marked: the score and what a pass needs (R-ACTIVITY-013). */
export const EXAM_MARKED: ReadonlySet<string> = new Set(["line.activity.exam-passed", "line.activity.exam-failed"]);

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
export function asPiece(line: ReportLine): ReportLine {
  const { quality, value } = line.params;
  if (line.key !== "line.quality.gain" || quality !== PORTFOLIO || typeof value !== "number") return line;
  return value > PIECES_ASKED ? { ...line, key: PIECE_MORE, params: { pieces: value } } : { ...line, key: PIECE, params: { pieces: value, need: PIECES_ASKED } };
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

/** The settlement cleared (docs/rules/home.md R-HOME-003): it leads News as it leads the results. */
const EVICTED: ReadonlySet<string> = new Set(["line.home.evicted", "line.home.evicted-no-cash"]);

function leads(line: ReportLine): boolean {
  return EVICTED.has(line.key) || isUnpaid(line) || line.key.startsWith("ui.results.unpaid");
}

/** Money that went unpaid leads News as it leads the results (R-WORLD-008), after the room cleared away. */
function newsOrder(lines: readonly ReportLine[]): ReportLine[] {
  return [...lines.filter((line) => EVICTED.has(line.key)), ...lines.filter((line) => leads(line) && !EVICTED.has(line.key)), ...lines.filter((line) => !leads(line))];
}

/**
 * The month's lines as News tells them: those of what was done mid-month (an agent paid, an ask answered) first, money
 * unpaid leading, each in the results' own words, so News never tells the month another way (R-WORLD-008; the tenth
 * review, W11: a piece for the portfolio was "one of three" on the results and "little work to show" in News).
 */
export function newsLines(midMonth: readonly ReportLine[], report: readonly ReportLine[]): ReportLine[] {
  return newsOrder(tidyLines([...midMonth, ...report]).map((line) => toldOnResults(asPiece(toldUnpaid(line)))));
}
