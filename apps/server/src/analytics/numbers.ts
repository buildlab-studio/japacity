// R-ANALYTICS-008, R-ANALYTICS-013: the numbers
// that the nightly job adds beside the game counters (nightly.ts): sessions,
// the funnel's server steps, lives started, secured and departed, the economy
// in bands, top-ups, the players of the last week and month, every account so
// far, and the reports still open. Counts and sums only: no row names an
// account, a character or a life (R-ANALYTICS-007). Plain functions over plain data.
import { HELD_BANDS, MONTH_BANDS, SESSION_BANDS, SESSION_GAP_MINUTES } from "@japacity/content";
import { time } from "@japacity/sim";
import type { AccountRow, CounterTotal, RegionCount } from "@japacity/store";

import { dayStart } from "../ops/day";
import { dayName } from "./day";
import { NO_REGION } from "./list";
import type { DayFacts } from "./nightly";
import type { Life, Played } from "./replay";

/** What the nightly job reads beside the day's lives, each by region. */
export interface NumbersFacts extends DayFacts {
  /** Distinct players over the 7 days ending with the day. */
  weekly: RegionCount[];
  /** Distinct players over the 30 days ending with the day. */
  monthly: RegionCount[];
  /** Every account made before the day's end. */
  accounts: RegionCount[];
  /** The reports open as the day ends, each by its reason and its reporter's region. */
  openReports: { reason: string; region: string }[];
}

/** The events these counters read, as their kinds write them. */
type Counted =
  | { type: "prologue/closed" }
  | { type: "chapter/closed" }
  | { type: "route/moved"; to: string }
  | { type: "status/granted"; why: string }
  | { type: "wallet/credited"; currency: string; amount: number; reason: string };

/** R-WALLET-020: the reason a bought top-up is credited with. */
const TOP_UP = "top-up";

/** R-STATUS-007: the grants that secure a life abroad, as the secured card reads them. */
const SECURING = new Set(["settled", "citizen"]);

const regionOf = (account: AccountRow | null) => (account === null || account.country === "" ? NO_REGION : account.country);

function tally(into: Map<string, CounterTotal>, row: CounterTotal): void {
  if (row.count === 0) return;
  const key = JSON.stringify([row.day, row.region, row.name, row.key]);
  into.set(key, { ...row, count: (into.get(key)?.count ?? 0) + row.count });
}

/** The band whose start is the largest at or under `value`; bands are listed from the smallest start. */
function bandOf(bands: readonly { key: string; from: number }[], value: number): string {
  let found = bands[0]?.key ?? "";
  for (const band of bands) if (value >= band.from) found = band.key;
  return found;
}

/** R-ANALYTICS-013: a session's length band. */
export function sessionBand(lengthMs: number): string {
  return bandOf(SESSION_BANDS, Math.floor(lengthMs / time.MINUTE_MS));
}

/** R-ANALYTICS-008: `economy/held`'s key for a life in month `month` (1 is its first after the years before) holding `kobo`. */
export function heldKey(month: number, kobo: number): string {
  return `${bandOf(MONTH_BANDS, month)}:${bandOf(HELD_BANDS, Math.max(0, kobo))}`;
}

/**
 * R-ANALYTICS-013: one account's sessions on a day, as their lengths. A
 * session is its player's commands with no gap over `SESSION_GAP_MINUTES`,
 * cut at the day's edges; its length runs from its first command to its last.
 */
export function sessionLengths(times: readonly number[]): number[] {
  const sorted = [...times].sort((left, right) => left - right);
  const lengths: number[] = [];
  let first: number | null = null;
  let last = 0;
  for (const at of sorted) {
    if (first !== null && at - last > SESSION_GAP_MINUTES * time.MINUTE_MS) {
      lengths.push(last - first);
      first = null;
    }
    first ??= at;
    last = at;
  }
  if (first !== null) lengths.push(last - first);
  return lengths;
}

/** The first played row of the life whose events hold one that `matches`, or null. */
function firstWith(life: Life, matches: (event: Counted) => boolean): Played | null {
  return life.played.find((played) => (played.events as Counted[]).some(matches)) ?? null;
}

/** R-ANALYTICS-008, R-ANALYTICS-013: every total the day adds beside the game counters. */
export function numbersTotals(facts: NumbersFacts): CounterTotal[] {
  const start = dayStart(facts.day);
  const end = dayStart(facts.day + 1);
  const day = dayName(facts.day);
  const into = new Map<string, CounterTotal>();
  const add = (region: string, name: string, key: string, count = 1) => tally(into, { day, region, name, key, count });
  const onDay = (played: Played | null) => played !== null && played.row.at >= start && played.row.at < end;
  const times = new Map<string, { region: string; at: number[] }>();

  for (const { life, account } of facts.active) {
    const region = regionOf(account);
    const today = life.played.filter((played) => onDay(played));
    const own = today.filter((played) => played.row.sender === "player");
    if (own.length > 0) {
      const held = times.get(life.account) ?? { region, at: [] };
      held.at.push(...own.map((played) => played.row.at));
      times.set(life.account, held);
    }

    // The funnel's server steps, each once in a life, on the day it came.
    if (today.some((played) => played.row.v === 1)) {
      add(region, "lives/started", region);
      add(region, "funnel/step", "begin");
    }
    if (onDay(firstWith(life, (event) => event.type === "prologue/closed"))) add(region, "funnel/step", "world");
    if (onDay(life.played.find((played) => played.afterPrologue && played.row.command.type === "turn/end" && played.turn === 1) ?? null)) add(region, "funnel/step", "month-1");
    if (onDay(firstWith(life, (event) => event.type === "chapter/closed"))) add(region, "funnel/step", "chapter-1");
    if (onDay(firstWith(life, (event) => event.type === "status/granted" && SECURING.has(event.why)))) add(region, "lives/secured", region);

    for (const played of today) {
      for (const event of played.events as Counted[]) {
        if (event.type === "route/moved" && event.to === "departed") add(region, "japa/departed", region);
        if (event.type === "wallet/credited" && event.reason === TOP_UP && event.currency === "NGN") {
          add(region, "wallet/topped-up", "count");
          add(region, "wallet/topped-up", "kobo", event.amount);
        }
      }
    }

    // The economy as the day ends, for the lives past the years before.
    const at = life.atEnd ?? null;
    if (at !== null && !at.prologueOpen) add(region, "economy/held", heldKey(at.months + 1, at.nairaKobo));
  }

  for (const { region, at } of times.values()) {
    for (const length of sessionLengths(at)) {
      add(region, "sessions/count", region);
      add(region, "sessions/length", sessionBand(length));
    }
  }

  // R-ACCOUNT-021: every account is born a guest.
  for (const account of facts.created) add(regionOf(account), "players/guest", regionOf(account));
  for (const { region, count } of facts.weekly) add(region, "players/weekly", region, count);
  for (const { region, count } of facts.monthly) add(region, "players/monthly", region, count);
  for (const { region, count } of facts.accounts) add(region, "players/total", region, count);
  for (const { reason, region } of facts.openReports) add(region, "moderation/open", reason);

  return [...into.values()];
}
