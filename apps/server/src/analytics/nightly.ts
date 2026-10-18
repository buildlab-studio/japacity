// R-ANALYTICS-008, R-ANALYTICS-011: the game counters of one UTC day, made
// from the replayed lives of the characters that logged a command on it and
// the accounts created on it. Plain functions over plain data.
import type { ReportLine } from "@japacity/sim";
import type { AccountRow, CounterTotal } from "@japacity/store";

import { dayStart, utcDay } from "../ops/day";
import { dayName } from "./day";
import { NO_REGION } from "./list";
import type { Life, Played } from "./replay";

/** One active character: its replayed life and its account's row, null once the account is gone. */
export interface ActiveLife {
  character: string;
  life: Life;
  account: AccountRow | null;
}

export interface DayFacts {
  /** The UTC day number counted. */
  day: number;
  active: ActiveLife[];
  created: AccountRow[];
}

/** The events the counters read, as their kinds write them. */
type Counted =
  | { type: "chapter/closed"; chapter: string }
  | { type: "chapter/reopened"; chapters: string[] }
  | { type: "route/moved"; route: string; to: string }
  | { type: "route/refused"; reasons: string[] }
  | { type: "offer/taken"; entry: string; choice: string }
  | { type: "place/returned"; shape: string }
  | { type: "lottery/bought"; tickets: number };

/** R-ANALYTICS-008: the days after sign-up a return is counted on, close enough that the returns make a curve. */
const RETURNED: Partial<Record<number, string>> = { 1: "d1", 3: "d3", 7: "d7", 14: "d14", 30: "d30" };

/**
 * R-GUIDE-014: a line of tone `good` that follows from the player's own
 * choice: pay from a job or a gig, a chapter item or a goal met, a route heard.
 * guides.md names these in words, not keys; these are the keys the kinds give
 * them.
 */
const EARLY_WIN_KEYS = new Set([
  "line.activity.salary",
  "line.activity.salary-first-foreign",
  "line.activity.salary-first-abroad",
  "line.activity.gig",
  "line.activity.side-pay",
  "line.activity.overtime",
  "line.chapter.closed",
  "line.goal.done",
  "line.route.heard",
]);

export function isEarlyWin(line: ReportLine): boolean {
  return line.tone === "good" && EARLY_WIN_KEYS.has(line.key);
}

const regionOf = (account: AccountRow | null) => (account === null || account.country === "" ? NO_REGION : account.country);

/** Adds one to a total, keyed so the same day, region, name and key fold into one row. */
function tally(into: Map<string, CounterTotal>, row: CounterTotal): void {
  const key = JSON.stringify([row.day, row.region, row.name, row.key]);
  const held = into.get(key);
  into.set(key, { ...row, count: (held?.count ?? 0) + row.count });
}

function onDay(played: Played, start: number, end: number): boolean {
  return played.row.at >= start && played.row.at < end;
}

/** R-ANALYTICS-011: the turn of the first early win before the end of the first day, as its key. */
function earlyWinKey(life: Life | null, end: number): string {
  const first = life?.played.find((played) => played.row.at < end && played.afterPrologue && played.lines.some(isEarlyWin));
  if (first === undefined) return "none";
  return first.turn <= 3 ? String(first.turn) : "later";
}

function eventTotals(day: string, region: string, played: Played, into: Map<string, CounterTotal>): void {
  const add = (name: string, key: string, count = 1) => tally(into, { day, region, name, key, count });
  for (const event of played.events as Counted[]) {
    switch (event.type) {
      case "chapter/closed":
        add("chapter/closed", event.chapter);
        break;
      case "chapter/reopened":
        // R-CHAPTER-003: a grant withdrawn before the flight reopens the chapters it closed; each is counted.
        for (const chapter of event.chapters) add("chapter/reopened", chapter);
        break;
      case "route/moved":
        add("route/moved", `${event.route}:${event.to}`);
        break;
      case "route/refused":
        if (event.reasons[0] !== undefined) add("route/refused", event.reasons[0]);
        break;
      case "offer/taken":
        add("offer/chosen", `${event.entry}:${event.choice}`);
        break;
      case "place/returned":
        add("place/returned", event.shape);
        break;
      case "lottery/bought":
        add("lottery/tickets", region, event.tickets);
        break;
      default:
        break;
    }
  }
}

/** R-ANALYTICS-008, R-ANALYTICS-011: every total the day adds, folded by day, region, name and key. */
export function nightlyTotals(facts: DayFacts): CounterTotal[] {
  const start = dayStart(facts.day);
  const end = dayStart(facts.day + 1);
  const day = dayName(facts.day);
  const into = new Map<string, CounterTotal>();
  const activeAccounts = new Map<string, AccountRow | null>();

  for (const { life, account } of facts.active) {
    const region = regionOf(account);
    const today = life.played.filter((played) => onDay(played, start, end));
    // The player's own commands make a player active; the authority's grants and a stand-in's turns do not.
    const own = today.filter((played) => played.row.sender === "player");
    if (own.length > 0) activeAccounts.set(life.account, account);
    for (const played of own) if (played.row.command.type === "turn/end") tally(into, { day, region, name: "turns/ended", key: region, count: 1 });
    for (const played of today) eventTotals(day, region, played, into);
  }

  for (const account of activeAccounts.values()) {
    const region = regionOf(account);
    tally(into, { day, region, name: "players/active", key: region, count: 1 });
    if (account === null) continue;
    // R-ANALYTICS-011: a return is kept on the sign-up day, so the dashboard reads it by sign-up week.
    const signedUp = utcDay(account.createdAt);
    const key = RETURNED[facts.day - signedUp];
    if (key !== undefined) tally(into, { day: dayName(signedUp), region, name: "players/returned", key, count: 1 });
  }

  const lives = new Map(facts.active.map((each) => [each.life.account, each.life]));
  for (const account of facts.created) {
    const region = regionOf(account);
    tally(into, { day, region, name: "players/new", key: region, count: 1 });
    tally(into, { day, region, name: "first/early-win", key: earlyWinKey(lives.get(account.id) ?? null, end), count: 1 });
  }

  return [...into.values()];
}
