// The Numbers tab (analytics.md R-ANALYTICS-009, 012, 013): the figures an
// investor asks for, live from `GET /api/admin/stats`, as plain tables. The
// server made every division and hid every small count (R-ANALYTICS-010); the
// page only lays them out.
import type { Regional, Returned, Shown, Stats, StatsPeriod } from "@japacity/api";

import { formatBp, formatMoney, formatNumber } from "../../shared/words/format";
import { shownCount, utcTime } from "./admin.format";
import { words, type AdminKey } from "./admin.words";
import type { AdminApi } from "./api";
import { Loaded, ReloadButton, Section, Table, useLoad } from "./admin.ui";

type Counted = "players" | "newPlayers" | "guests" | "secured" | "livesStarted" | "livesSecured" | "departed" | "turnsEnded" | "sessions" | "clientErrors" | "feedbackSent" | "reportsOpen" | "topUps";
type Rate = keyof StatsPeriod["rates"];

const COUNTED: readonly Counted[] = ["players", "newPlayers", "guests", "secured", "livesStarted", "livesSecured", "departed", "turnsEnded", "sessions", "clientErrors", "feedbackSent", "reportsOpen", "topUps"];
const RATES: readonly Rate[] = ["dailyOverPeriodBp", "sessionsPerPlayerBp", "errorsPerThousandSessions", "departedPerNewBp", "securedPerGuestBp"];
const RETURNS = ["d1", "d3", "d7", "d14", "d30"] as const;

const hidden = () => words("admin.analytics.hidden");

function bp(value: number | null): string {
  return value === null ? hidden() : formatBp(value);
}

function naira(kobo: number | null): string {
  return kobo === null ? hidden() : formatMoney(kobo, "NGN");
}

function figure(value: Shown | Regional): string {
  return typeof value === "object" && "all" in value ? shownCount(value.all) : shownCount(value);
}

function rateOf(rate: Rate, value: number | null): string {
  if (value === null) return hidden();
  return rate === "errorsPerThousandSessions" ? formatNumber(value) : formatBp(value);
}

function returned(value: Returned): string {
  return words("admin.numbers.both", { count: shownCount(value.count), rate: bp(value.bp) });
}

function regionRows(regional: Regional): string[][] {
  return [[words("admin.numbers.all"), shownCount(regional.all)], ...Object.entries(regional.regions).map(([region, count]) => [region, shownCount(count)])];
}

function Periods({ stats }: { stats: Stats }) {
  const periods = [stats.today, stats.last7, stats.last30];
  return (
    <Table
      caption={words("admin.numbers.periods")}
      head={[words("admin.numbers.figure"), words("admin.numbers.today"), words("admin.numbers.last7"), words("admin.numbers.last30")]}
      rows={[
        ...COUNTED.map((name) => [words(`admin.numbers.${name}` as AdminKey), ...periods.map((period) => figure(period[name]))]),
        [words("admin.numbers.topUpKobo"), ...periods.map((period) => naira(period.topUpKobo))],
        ...RATES.map((rate) => [words(`admin.numbers.${rate}` as AdminKey), ...periods.map((period) => rateOf(rate, period.rates[rate]))]),
      ]}
    />
  );
}

function Numbers({ stats }: { stats: Stats }) {
  const heldKeys = [...new Set(stats.economy.cells.map((cell) => cell.held))];
  const monthKeys = [...new Set(stats.economy.cells.map((cell) => cell.months))];
  const lives = (months: string, held: string) => stats.economy.cells.find((cell) => cell.months === months && cell.held === held)?.lives ?? 0;
  return (
    <div className="flex flex-col gap-6" data-numbers>
      <p>{words("admin.numbers.read", { at: utcTime(stats.now.at), to: stats.last30.to })}</p>
      <Table caption={words("admin.numbers.online")} head={[words("admin.numbers.region"), words("admin.numbers.count")]} rows={regionRows(stats.now.online)} />
      <Table caption={words("admin.numbers.peak")} head={[words("admin.numbers.region"), words("admin.numbers.count")]} rows={regionRows(stats.now.peakToday)} />
      <Periods stats={stats} />
      <Table caption={words("admin.numbers.totals", { day: stats.totals.day })} head={[words("admin.numbers.region"), words("admin.numbers.count")]} rows={regionRows(stats.totals.players)} />
      <Table
        caption={words("admin.numbers.funnel", { from: stats.funnel.from, to: stats.funnel.to })}
        head={[words("admin.numbers.step"), words("admin.numbers.count"), words("admin.numbers.ofFirst")]}
        rows={stats.funnel.steps.map((step) => [step.step, shownCount(step.count), bp(step.ofFirstBp)])}
      />
      <Table
        caption={words("admin.numbers.retention")}
        head={[words("admin.numbers.week"), words("admin.numbers.newPlayers"), ...RETURNS.map((key) => words("admin.numbers.returned", { key: key.slice(1) })), words("admin.numbers.securedWeek")]}
        rows={stats.retention.weeks.map((week) => [week.week, shownCount(week.newPlayers), ...RETURNS.map((key) => returned(week.returned[key])), returned(week.secured)])}
      />
      <Table
        caption={words("admin.numbers.sessionLengths", { from: stats.sessions.from, to: stats.sessions.to })}
        head={[words("admin.numbers.length"), words("admin.numbers.count")]}
        rows={[...Object.entries(stats.sessions.lengths).map(([band, count]) => [band, shownCount(count)]), [words("admin.numbers.sessions"), shownCount(stats.sessions.count)], [words("admin.numbers.perPlayer"), bp(stats.sessions.perPlayerBp)]]}
      />
      <Table
        caption={words("admin.numbers.shares", { from: stats.shares.from, to: stats.shares.to })}
        head={[words("admin.numbers.kind"), words("admin.numbers.pressed"), words("admin.numbers.completed"), words("admin.numbers.arrived"), words("admin.numbers.perShare")]}
        rows={stats.shares.kinds.map((kind) => [kind.kind, shownCount(kind.pressed), shownCount(kind.completed), shownCount(kind.arrived), bp(kind.arrivedPerShareBp)])}
      />
      <Table
        caption={words("admin.numbers.adverts", { from: stats.adverts.from, to: stats.adverts.to })}
        head={[words("admin.numbers.figure"), words("admin.numbers.count")]}
        rows={[
          [words("admin.numbers.impressions"), shownCount(stats.adverts.impressions)],
          [words("admin.numbers.taps"), shownCount(stats.adverts.taps)],
          [words("admin.numbers.revenue"), naira(stats.adverts.revenueKobo)],
          [words("admin.numbers.revenuePerPlayer"), naira(stats.adverts.revenuePerPlayerKobo)],
        ]}
      />
      <Table
        caption={words("admin.numbers.economy", { day: stats.economy.day })}
        head={[words("admin.numbers.months"), ...heldKeys.map((held) => words(`admin.numbers.held.${held}` as AdminKey))]}
        rows={monthKeys.map((months) => [months, ...heldKeys.map((held) => shownCount(lives(months, held)))])}
      />
    </div>
  );
}

export function NumbersTab({ api }: { api: AdminApi }) {
  const stats = useLoad(() => api.stats());
  return (
    <Section title={words("admin.tab.numbers")} action={<ReloadButton onClick={stats.reload} />}>
      <Loaded reply={stats.reply}>{({ stats: data }) => <Numbers stats={data} />}</Loaded>
    </Section>
  );
}
