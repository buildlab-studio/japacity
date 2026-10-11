import { content } from "@japacity/content";
import { time } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { dayName, dayNumber } from "./day";
import { buildStats, statsFrom } from "./stats";
import type { StatsInput } from "./stats";
import { STATS_KEYS } from "./stats.contract";

const { minShown } = content.tuning.analytics;
const TODAY = dayNumber("2026-10-21") ?? 0;
const YESTERDAY = TODAY - 1;
const NOW = TODAY * time.DAY_MS + 9 * time.HOUR_MS;
const row = (day: number, name: string, key: string, count: number, region = "NG"): CounterTotal => ({ day: dayName(day), region, name, key, count });

function input(totals: CounterTotal[], over: Partial<StatsInput> = {}): StatsInput {
  return { now: NOW, today: TODAY, totals, online: [], todayPlayers: [], ...over };
}

/** The shape of a value: its keys all the way down, with records of regions, steps and weeks read by their first entry. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length === 0 ? [] : [shapeOf(value[0])];
  if (typeof value !== "object" || value === null) return typeof value;
  return Object.fromEntries(Object.keys(value).map((key) => [key, shapeOf((value as Record<string, unknown>)[key])]));
}

const PERIOD = {
  from: "string",
  to: "string",
  players: { all: "number", regions: { NG: "number" } },
  newPlayers: { all: "number", regions: { NG: "number" } },
  guests: "number",
  secured: "number",
  livesStarted: "number",
  livesSecured: "number",
  departed: "number",
  turnsEnded: "number",
  sessions: "number",
  clientErrors: "number",
  feedbackSent: "number",
  reportsOpen: "number",
  topUps: "number",
  topUpKobo: "number",
  rates: { dailyOverPeriodBp: "number", sessionsPerPlayerBp: "number", errorsPerThousandSessions: "number", departedPerNewBp: "number", securedPerGuestBp: "number" },
};

/** Every count a figure reads, at `minShown`, so nothing is hidden and every division is made. */
function everything(): CounterTotal[] {
  const rows: CounterTotal[] = [];
  for (let day = statsFrom(TODAY); day <= TODAY; day += 1) {
    for (const name of ["players/active", "players/new", "players/guest", "players/secured", "players/secured-by-signup", "lives/started", "lives/secured", "japa/departed", "turns/ended", "sessions/count", "client/error", "feedback/sent", "moderation/open", "players/weekly", "players/monthly", "players/total", "players/online-peak"]) rows.push(row(day, name, "NG", minShown));
    for (const key of ["d1", "d3", "d7", "d14", "d30"]) rows.push(row(day, "players/returned", key, minShown));
    rows.push(row(day, "players/online-peak", "peak", minShown, "all"));
    rows.push(row(day, "wallet/topped-up", "count", minShown), row(day, "wallet/topped-up", "kobo", 1000), row(day, "advert/revenue", "kobo", 5000));
    for (const key of ["under-2", "2-5", "5-15", "15-30", "over-30"]) rows.push(row(day, "sessions/length", key, minShown));
    for (const name of ["share/pressed", "share/completed", "share/arrival"]) rows.push(row(day, name, "chapter", minShown));
    for (const step of ["holding", "invited", "begin", "world", "month-1", "chapter-1", "secured"]) rows.push(row(day, "funnel/step", step, minShown));
    for (const step of ["door-1", "door-2", "page"]) rows.push(row(day, "screen/opened", step, minShown));
    rows.push(row(day, "advert/impression", "advert.billboard-ikorodu", minShown), row(day, "advert/tap", "advert.billboard-ikorodu", minShown), row(day, "economy/held", "1-3:0", minShown));
  }
  return rows;
}

describe("the admin's numbers", () => {
  test("[R-ANALYTICS-012] given every figure shown, when the numbers are built, then the reply has the frozen shape: the eleven sections in order, and each section's fields", () => {
    const stats = buildStats(content, input(everything(), { online: [{ region: "NG", count: minShown }], todayPlayers: [{ region: "NG", count: minShown }] }));
    expect(Object.keys(stats)).toEqual([...STATS_KEYS]);
    expect(shapeOf(stats)).toEqual({
      now: { at: "number", online: { all: "number", regions: { NG: "number" } }, peakToday: { all: "number", regions: { NG: "number" } } },
      today: { ...PERIOD, rates: { ...PERIOD.rates, dailyOverPeriodBp: "object" } },
      last7: PERIOD,
      last30: PERIOD,
      totals: { day: "string", players: { all: "number", regions: { NG: "number" } } },
      funnel: { from: "string", to: "string", steps: [{ step: "string", count: "number", ofFirstBp: "number" }] },
      retention: {
        from: "string",
        to: "string",
        weeks: [{ week: "string", newPlayers: "number", returned: Object.fromEntries(["d1", "d3", "d7", "d14", "d30"].map((key) => [key, { count: "number", bp: "number" }])), secured: { count: "number", bp: "number" } }],
      },
      sessions: { from: "string", to: "string", count: "number", lengths: { "under-2": "number", "2-5": "number", "5-15": "number", "15-30": "number", "over-30": "number" }, perPlayerBp: "number" },
      shares: { from: "string", to: "string", kinds: [{ kind: "string", pressed: "number", completed: "number", arrived: "number", arrivedPerShareBp: "number" }] },
      adverts: { from: "string", to: "string", impressions: "number", taps: "number", revenueKobo: "number", revenuePerPlayerKobo: "number" },
      economy: { day: "string", cells: [{ months: "string", held: "string", lives: "number" }] },
    });
    expect(stats.funnel.steps.map((step) => step.step)).toEqual(["holding", "invited", "door-1", "door-2", "page", "begin", "world", "month-1", "chapter-1", "secured"]);
    expect(stats.economy.cells).toHaveLength(12);
  });

  test("[R-ANALYTICS-012] given a day of 9:00, when the numbers are built, then today is the day so far, the 7 and 30 days end yesterday, and the totals are yesterday's", () => {
    const stats = buildStats(content, input([]));
    expect([stats.today.from, stats.today.to]).toEqual([dayName(TODAY), dayName(TODAY)]);
    expect([stats.last7.from, stats.last7.to]).toEqual([dayName(YESTERDAY - 6), dayName(YESTERDAY)]);
    expect([stats.last30.from, stats.last30.to]).toEqual([dayName(YESTERDAY - 29), dayName(YESTERDAY)]);
    expect(stats.totals.day).toBe(dayName(YESTERDAY));
    expect(stats.now.at).toBe(NOW);
    for (const week of stats.retention.weeks) expect(new Date(`${week.week}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  test("[R-ANALYTICS-010] [R-ANALYTICS-012] given regions either side of the smallest number shown, when the numbers are built, then each region is hidden on its own and the whole game by its sum, the whole game's peak is its own sample and never the regions' sum, and no small count appears as itself", () => {
    const stats = buildStats(
      content,
      input([row(YESTERDAY, "players/total", "NG", 40), row(YESTERDAY, "players/total", "GB", 3, "GB"), row(TODAY, "players/online-peak", "peak", 2, "GB")], {
        online: [{ region: "NG", count: minShown }, { region: "GB", count: 1 }],
        todayPlayers: [{ region: "GB", count: minShown - 1 }],
      }),
    );
    expect(stats.now.online).toEqual({ all: minShown + 1, regions: { GB: { fewerThan: minShown }, NG: minShown } });
    expect(stats.now.peakToday).toEqual({ all: { fewerThan: minShown }, regions: { GB: { fewerThan: minShown } } });
    expect(buildStats(content, input([row(TODAY, "players/online-peak", "peak", 12, "NG"), row(TODAY, "players/online-peak", "peak", 11, "GB"), row(TODAY, "players/online-peak", "peak", 15, "all")])).now.peakToday).toEqual({ all: 15, regions: { GB: 11, NG: 12 } });
    expect(stats.totals.players).toEqual({ all: 43, regions: { GB: { fewerThan: minShown }, NG: 40 } });
    expect(stats.today.players).toEqual({ all: { fewerThan: minShown }, regions: { GB: { fewerThan: minShown } } });
    const text = JSON.stringify(stats);
    for (const small of [1, 2, 3, minShown - 1]) expect(text).not.toMatch(new RegExp(`"(?:all|GB|NG)":${String(small)}[,}]`));
  });

  test("[R-ANALYTICS-012] given the counts behind each division, when the numbers are built, then each is made on the server in basis points, and is null while either side is hidden", () => {
    const totals: CounterTotal[] = [];
    for (let day = YESTERDAY - 29; day <= YESTERDAY; day += 1) totals.push(row(day, "players/active", "NG", 20), row(day, "sessions/count", "NG", 30));
    totals.push(
      row(YESTERDAY, "players/monthly", "NG", 100),
      row(YESTERDAY, "players/new", "NG", 200),
      row(YESTERDAY, "japa/departed", "NG", 50),
      row(YESTERDAY, "client/error", "render", 45),
      row(YESTERDAY, "players/guest", "NG", 200),
      row(YESTERDAY, "players/secured", "NG", 9),
      row(YESTERDAY, "share/completed", "send-off", 40),
      row(YESTERDAY, "share/arrival", "send-off", 30),
      row(YESTERDAY, "funnel/step", "holding", 400),
      row(YESTERDAY, "funnel/step", "invited", 100),
      row(YESTERDAY, "screen/opened", "door-1", 80),
      row(YESTERDAY, "advert/revenue", "kobo", 1_200_000),
      row(YESTERDAY, "wallet/topped-up", "count", 3),
      row(YESTERDAY, "wallet/topped-up", "kobo", 7_500_000),
    );
    const stats = buildStats(content, input(totals));
    expect(stats.last30.rates).toEqual({ dailyOverPeriodBp: 2000, sessionsPerPlayerBp: 15000, errorsPerThousandSessions: 50, departedPerNewBp: 2500, securedPerGuestBp: null });
    expect(stats.sessions.perPlayerBp).toBe(15000);
    expect(stats.shares.kinds.find((kind) => kind.kind === "send-off")).toMatchObject({ completed: 40, arrived: 30, arrivedPerShareBp: 7500 });
    expect(stats.funnel.steps.slice(0, 3).map((step) => [step.step, step.count, step.ofFirstBp])).toEqual([
      ["holding", 400, 10000],
      ["invited", 100, 2500],
      ["door-1", 80, 2000],
    ]);
    expect(stats.adverts).toMatchObject({ revenueKobo: 1_200_000, revenuePerPlayerKobo: 2000 });
    // R-ANALYTICS-007: three top-ups are too few to show their sum.
    expect(stats.last30).toMatchObject({ topUps: { fewerThan: minShown }, topUpKobo: null });
    expect(JSON.stringify(stats)).not.toContain("7500000");
  });
});
