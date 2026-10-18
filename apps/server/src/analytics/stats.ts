// analytics:admin-stats-for-admins-only: the admin's numbers, built from the stored
// totals and two live counts of the command log. Plain functions over plain
// data; the shape is `Stats` of @japacity/api. Every count passes through `shown`
// (analytics:small-counts-shown-as-fewer), and a division is made only when both its sides show.
import type { EconomyCell, FunnelStep, PeriodRates, Regional, RetentionWeek, Returned, ShareKind, Shown, Stats, StatsPeriod } from "@japacity/api";
import { FUNNEL_STEPS, HELD_BANDS, MONTH_BANDS, SESSION_BANDS } from "@japacity/content";
import type { Content } from "@japacity/sim";
import { int, time } from "@japacity/sim";
import type { CounterTotal, RegionCount } from "@japacity/store";

import { shown } from "./dashboard";
import { WHOLE_GAME } from "./list";

/** What the endpoint read. */
export interface StatsInput {
  /** Milliseconds since 1970. */
  now: number;
  /** The UTC day number of `now`. */
  today: number;
  /** Every stored total from `statsFrom(today)` to today. */
  totals: readonly CounterTotal[];
  /** Live: the players of the last `ONLINE_MINUTES`, by region. */
  online: readonly RegionCount[];
  /** Live: today's players so far, by region. */
  todayPlayers: readonly RegionCount[];
}

/** The top-level keys, in the order analytics:admin-stats-for-admins-only gives them. */
export const STATS_KEYS = ["now", "today", "last7", "last30", "totals", "funnel", "retention", "sessions", "shares", "adverts", "economy"] as const;

const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
/** 1 January 1970 was a Thursday: three days after a Monday. */
const MONDAY_OFFSET = 3;
const RETURN_KEYS = ["d1", "d3", "d7", "d14", "d30"] as const;
const BP = 10_000;
const THOUSAND = 1000;

const weekOf = (day: number) => day - ((day + MONDAY_OFFSET) % WEEK_DAYS);

/** The first day the endpoint reads: the Monday of the week the 30 whole days begin in. */
export function statsFrom(today: number): number {
  return weekOf(today - MONTH_DAYS);
}

interface Window {
  first: number;
  last: number;
}

/** The figures of one window, read by name and key. */
function within(totals: readonly CounterTotal[], window: Window) {
  const names = new Set<string>();
  for (let day = window.first; day <= window.last; day += 1) names.add(time.dayName(day));
  const rows = totals.filter((row) => names.has(row.day));
  const sum = (name: string, key?: string) => rows.filter((row) => row.name === name && (key === undefined || row.key === key)).reduce((total, row) => total + row.count, 0);
  const byRegion = (name: string): Map<string, number> => {
    const found = new Map<string, number>();
    for (const row of rows) if (row.name === name) found.set(row.region, (found.get(row.region) ?? 0) + row.count);
    return found;
  };
  return { rows, sum, byRegion };
}

function regional(counts: ReadonlyMap<string, number> | readonly RegionCount[], minShown: number): Regional {
  const entries: [string, number][] = Array.isArray(counts) ? counts.map((each: RegionCount): [string, number] => [each.region, each.count]) : [...(counts as ReadonlyMap<string, number>).entries()];
  const regions: Record<string, Shown> = {};
  let all = 0;
  for (const [region, count] of [...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) {
    regions[region] = shown(count, minShown);
    all += count;
  }
  return { all: shown(all, minShown), regions };
}

/** analytics:session-split-by-command-gaps: the day's peaks; the whole game's is kept under the region `all`, never a sum of the regions'. */
function peakOf(byRegion: ReadonlyMap<string, number>, minShown: number): Regional {
  const regions = new Map([...byRegion].filter(([region]) => region !== WHOLE_GAME));
  return { all: shown(byRegion.get(WHOLE_GAME) ?? 0, minShown), regions: regional(regions, minShown).regions };
}

/** `part` over `whole`, scaled; null while either is under `minShown`. */
function ratio(part: number, whole: number, scale: number, minShown: number): number | null {
  return whole < minShown || part < minShown ? null : int.mulDiv(part, scale, whole);
}

function period(input: StatsInput, window: Window, players: ReadonlyMap<string, number> | readonly RegionCount[], periodPlayers: number | null, minShown: number): StatsPeriod {
  const { sum, byRegion } = within(input.totals, window);
  const dailyPlayers = sum("players/active");
  const sessions = sum("sessions/count");
  const topUps = sum("wallet/topped-up", "count");
  const guests = sum("players/guest");
  const rates: PeriodRates = {
    dailyOverPeriodBp: periodPlayers === null ? null : ratio(dailyPlayers, periodPlayers * (window.last - window.first + 1), BP, minShown),
    sessionsPerPlayerBp: ratio(sessions, dailyPlayers, BP, minShown),
    errorsPerThousandSessions: ratio(sum("client/error"), sessions, THOUSAND, minShown),
    departedPerNewBp: ratio(sum("japa/departed"), sum("players/new"), BP, minShown),
    securedPerGuestBp: ratio(sum("players/secured"), guests, BP, minShown),
  };
  return {
    from: time.dayName(window.first),
    to: time.dayName(window.last),
    players: regional(players, minShown),
    newPlayers: regional(byRegion("players/new"), minShown),
    guests: shown(guests, minShown),
    secured: shown(sum("players/secured"), minShown),
    livesStarted: shown(sum("lives/started"), minShown),
    livesSecured: shown(sum("lives/secured"), minShown),
    departed: shown(sum("japa/departed"), minShown),
    turnsEnded: shown(sum("turns/ended"), minShown),
    sessions: shown(sessions, minShown),
    clientErrors: shown(sum("client/error"), minShown),
    feedbackSent: shown(sum("feedback/sent"), minShown),
    reportsOpen: shown(within(input.totals, { first: window.last, last: window.last }).sum("moderation/open"), minShown),
    topUps: shown(topUps, minShown),
    topUpKobo: topUps < minShown ? null : sum("wallet/topped-up", "kobo"),
    rates,
  };
}

/** analytics:admin-stats-for-admins-only: the numbers as the endpoint answers them. */
export function buildStats(content: Content, input: StatsInput): Stats {
  const { minShown } = content.tuning.analytics;
  const last = input.today - 1;
  const today: Window = { first: input.today, last: input.today };
  const week: Window = { first: last - WEEK_DAYS + 1, last };
  const month: Window = { first: last - MONTH_DAYS + 1, last };
  const lastDay = within(input.totals, { first: last, last });
  const ofMonth = within(input.totals, month);
  const ofToday = within(input.totals, today);

  const weekly = lastDay.byRegion("players/weekly");
  const monthly = lastDay.byRegion("players/monthly");
  const total = (counts: ReadonlyMap<string, number>) => [...counts.values()].reduce((sum, count) => sum + count, 0);

  const stepCount = (step: string) => (FUNNEL_STEPS.find((each) => each.step === step)?.from === "screen/opened" ? ofMonth.sum("screen/opened", step) : ofMonth.sum("funnel/step", step));
  const head = stepCount(FUNNEL_STEPS[0].step);
  const steps: FunnelStep[] = FUNNEL_STEPS.map(({ step }) => ({ step, count: shown(stepCount(step), minShown), ofFirstBp: ratio(stepCount(step), head, BP, minShown) }));

  const weeks: RetentionWeek[] = [];
  for (let monday = weekOf(month.first); monday <= last; monday += WEEK_DAYS) {
    const ofWeek = within(input.totals, { first: monday, last: monday + WEEK_DAYS - 1 });
    const newPlayers = ofWeek.sum("players/new");
    const returned = Object.fromEntries(RETURN_KEYS.map((key): [string, Returned] => [key, { count: shown(ofWeek.sum("players/returned", key), minShown), bp: ratio(ofWeek.sum("players/returned", key), newPlayers, BP, minShown) }])) as RetentionWeek["returned"];
    const guests = ofWeek.sum("players/guest");
    const secured = ofWeek.sum("players/secured-by-signup");
    weeks.push({ week: time.dayName(monday), newPlayers: shown(newPlayers, minShown), returned, secured: { count: shown(secured, minShown), bp: ratio(secured, guests, BP, minShown) } });
  }

  const sessions = ofMonth.sum("sessions/count");
  const dailyPlayers = ofMonth.sum("players/active");
  const lengths: Record<string, Shown> = {};
  for (const band of SESSION_BANDS) lengths[band.key] = shown(ofMonth.sum("sessions/length", band.key), minShown);

  const kinds: ShareKind[] = (content.analytics.counters.find((def) => def.name === "share/completed")?.keys as string[] | undefined ?? []).map((kind) => ({
    kind,
    pressed: shown(ofMonth.sum("share/pressed", kind), minShown),
    completed: shown(ofMonth.sum("share/completed", kind), minShown),
  }));

  const revenueKobo = ofMonth.sum("advert/revenue", "kobo");
  const cells: EconomyCell[] = MONTH_BANDS.flatMap((months) => HELD_BANDS.map((held) => ({ months: months.key, held: held.key, lives: shown(lastDay.sum("economy/held", `${months.key}:${held.key}`), minShown) })));

  return {
    now: { at: input.now, online: regional(input.online, minShown), peakToday: peakOf(ofToday.byRegion("players/online-peak"), minShown) },
    today: period(input, today, input.todayPlayers, null, minShown),
    last7: period(input, week, weekly, total(weekly), minShown),
    last30: period(input, month, monthly, total(monthly), minShown),
    totals: { day: time.dayName(last), players: regional(lastDay.byRegion("players/total"), minShown) },
    funnel: { from: time.dayName(month.first), to: time.dayName(last), steps },
    retention: { from: time.dayName(month.first), to: time.dayName(last), weeks },
    sessions: { from: time.dayName(month.first), to: time.dayName(last), count: shown(sessions, minShown), lengths, perPlayerBp: ratio(sessions, dailyPlayers, BP, minShown) },
    shares: { from: time.dayName(month.first), to: time.dayName(last), kinds },
    adverts: {
      from: time.dayName(month.first),
      to: time.dayName(last),
      impressions: shown(ofMonth.sum("advert/impression"), minShown),
      taps: shown(ofMonth.sum("advert/tap"), minShown),
      revenueKobo,
      revenuePerPlayerKobo: dailyPlayers < minShown ? null : int.divFloor(revenueKobo, dailyPlayers),
    },
    economy: { day: time.dayName(last), cells },
  };
}
