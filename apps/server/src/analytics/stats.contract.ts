// R-ANALYTICS-012: the frozen shape of `GET /api/admin/stats`.
// Every figure is a count or a sum from the analytics store or a live count of
// the command log; a count under `minShown` is only ever "fewer than" it
// (R-ANALYTICS-010), region by region and for the whole game. The divisions
// are made here for the page's convenience and are never stored. The admin
// page keeps a copy (apps/client/src/features/admin/admin.contract.ts) and a
// test holds both to these keys (stats.test.ts).

import type { Shown } from "./dashboard";

export type { Shown };

/** A count for the whole game and for each region, each hidden on its own when small. */
export interface Regional {
  all: Shown;
  regions: Record<string, Shown>;
}

/** The divisions of a period, in basis points (10000 is one each) unless named otherwise; null while either side is hidden. */
export interface PeriodRates {
  /** Stickiness: the average day's players over the period's players. Null for today. */
  dailyOverPeriodBp: number | null;
  /** Sessions over the days' players added up. */
  sessionsPerPlayerBp: number | null;
  /** Client errors for every thousand sessions. */
  errorsPerThousandSessions: number | null;
  /** Lives that departed over new players: the story's own success rate. */
  departedPerNewBp: number | null;
  /** Guests secured over guests made. */
  securedPerGuestBp: number | null;
}

/** Today so far, or the last 7 or 30 whole days. */
export interface StatsPeriod {
  from: string;
  to: string;
  /** Distinct players: today counted live, the 7 and 30 days from `players/weekly` and `players/monthly` of `to`. */
  players: Regional;
  newPlayers: Regional;
  guests: Shown;
  secured: Shown;
  livesStarted: Shown;
  livesSecured: Shown;
  departed: Shown;
  turnsEnded: Shown;
  sessions: Shown;
  clientErrors: Shown;
  feedbackSent: Shown;
  reportsOpen: Shown;
  topUps: Shown;
  /** The top-ups' sum in kobo, null while their count is hidden (R-ANALYTICS-007: never one player's money). */
  topUpKobo: number | null;
  rates: PeriodRates;
}

export interface FunnelStep {
  step: string;
  count: Shown;
  /** Of the first step's count. */
  ofFirstBp: number | null;
}

export interface Returned {
  count: Shown;
  /** Of the week's new players. */
  bp: number | null;
}

/** R-ANALYTICS-008: one sign-up week, Monday first. */
export interface RetentionWeek {
  week: string;
  newPlayers: Shown;
  returned: Record<"d1" | "d3" | "d7" | "d14" | "d30", Returned>;
  /** Guests of the week secured by now, over the week's guests: conversion by sign-up week. */
  secured: Returned;
}

export interface ShareKind {
  kind: string;
  pressed: Shown;
  completed: Shown;
  arrived: Shown;
  /** Arrivals over completed shares. */
  arrivedPerShareBp: number | null;
}

export interface EconomyCell {
  months: string;
  held: string;
  lives: Shown;
}

export interface Stats {
  now: {
    /** Milliseconds since 1970 when the figures were read. */
    at: number;
    online: Regional;
    /** Each region's highest five-minute sample today (R-ANALYTICS-013). */
    peakToday: { regions: Record<string, Shown> };
  };
  today: StatsPeriod;
  last7: StatsPeriod;
  last30: StatsPeriod;
  totals: {
    day: string;
    /** Every account made by the end of `day`. */
    players: Regional;
  };
  funnel: { from: string; to: string; steps: FunnelStep[] };
  retention: { from: string; to: string; weeks: RetentionWeek[] };
  sessions: { from: string; to: string; count: Shown; lengths: Record<string, Shown>; perPlayerBp: number | null };
  shares: { from: string; to: string; kinds: ShareKind[] };
  adverts: {
    from: string;
    to: string;
    impressions: Shown;
    taps: Shown;
    /** What advertisers paid for the period, in kobo (`advert/revenue`). */
    revenueKobo: number;
    /** Revenue over the days' players added up, in kobo; null while they are hidden. */
    revenuePerPlayerKobo: number | null;
  };
  economy: { day: string; cells: EconomyCell[] };
}

/** R-ANALYTICS-012: the reply. */
export type StatsReply = { ok: true; stats: Stats };

/** The top-level keys, in the order R-ANALYTICS-012 gives them. */
export const STATS_KEYS = ["now", "today", "last7", "last30", "totals", "funnel", "retention", "sessions", "shares", "adverts", "economy"] as const;
