// Players (admin:sections-alarms-first, analytics:dashboard-shows-fixed-list, analytics:admin-stats-for-admins-only,
// analytics:day-one-and-seven-return, analytics:small-counts-shown-as-fewer): growth, the funnel, return by sign-up week
// beside the reference lines, the first good moment by turn, sessions, shares and journeys. The server made every
// division and hid every small count; the page lays them out.
import type { Dashboard, Returned, Stats as StatsReply } from "@japacity/api";
import { text } from "@japacity/content";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { formatNumber } from "../../shared/words/format";
import { AreaChart } from "./admin.charts";
import { dayWords, rateWords, shownCount, shownNumber } from "./admin.format";
import { counterByKey, dailySeries, latestByKey, periodOf, windowLabels } from "./admin.series";
import { maybe, words } from "./admin.words";
import type { Shared } from "./AdminPage";
import { BarTable, Card, Field, Loaded, Note, PeriodPicker, Stat, Stats, Table } from "./admin.ui";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RETURNS = ["d1", "d3", "d7", "d14", "d30"] as const;
const EARLY = ["1", "2", "3", "later", "none"] as const;

/** analytics:day-one-and-seven-return: a return rate beside its reference line, marked under or over it. */
function Rate({ value, line }: { value: Returned; line: number | null }) {
  if (value.bp === null) return <span data-line="hidden">{rateWords(null)}</span>;
  const side = line === null ? "none" : value.bp < line ? "under" : "over";
  const colour = side === "under" ? "text-bad" : side === "over" ? "text-good" : "";
  return (
    <span data-line={side} className={colour}>
      {rateWords(value.bp)} <span className="text-xs text-text-2">({shownCount(value.count)})</span>
    </span>
  );
}

function ReturnTable({ stats, dashboard }: { stats: StatsReply; dashboard: Dashboard }) {
  const line = (key: (typeof RETURNS)[number]) => (key === "d1" ? dashboard.reference.d1Bp : key === "d7" ? dashboard.reference.d7Bp : null);
  return (
    <Card title={words("admin.return")} subtitle={words("admin.return.lines", { d1: rateWords(dashboard.reference.d1Bp), d7: rateWords(dashboard.reference.d7Bp) })} span>
      <Table
        caption={words("admin.return")}
        hideCaption
        head={[words("admin.week"), words("admin.figure.newPlayers"), ...RETURNS.map((key) => words("admin.return.day", { day: key.slice(1) })), words("admin.return.secured")]}
        rows={stats.retention.weeks.map((week) => [dayWords(week.week), shownCount(week.newPlayers), ...RETURNS.map((key) => <Rate key={key} value={week.returned[key]} line={line(key)} />), <Rate key="secured" value={week.secured} line={null} />])}
      />
      <Note>{words("admin.return.note")}</Note>
    </Card>
  );
}

function Journeys({ dashboard }: { dashboard: Dashboard }) {
  const playing = latestByKey(dashboard.counters, "lives/playing");
  const roads = counterByKey(dashboard.counters, "route/moved", (key) => (key.endsWith(":departed") ? key.slice(0, -":departed".length) : null));
  const back = counterByKey(dashboard.counters, "place/returned");
  const refused = counterByKey(dashboard.counters, "route/refused");
  const where = (key: "home" | "road" | "abroad") => (playing === null ? words("admin.no-data") : shownCount(playing.byKey.get(key) ?? 0));
  return (
    <Card title={words("admin.journeys")} subtitle={playing === null ? undefined : words("admin.journeys.asof", { day: dayWords(playing.day) })} span>
      <Stats>
        <Stat label={words("admin.journeys.home")} value={where("home")} />
        <Stat label={words("admin.journeys.road")} value={where("road")} />
        <Stat label={words("admin.journeys.abroad")} value={where("abroad")} />
      </Stats>
      <div className="grid gap-4 md:grid-cols-3">
        <BarTable caption={words("admin.journeys.roads")} head={[words("admin.journeys.road.label"), words("admin.count")]} bars={roads.map((road) => ({ label: text[`${road.key}.name`] ?? road.key, size: road.sum.total, text: formatNumber(road.sum.total) }))} />
        <BarTable caption={words("admin.journeys.back")} head={[words("admin.journeys.why"), words("admin.count")]} bars={back.map((reason) => ({ label: maybe(`admin.returned.${reason.key}`, reason.key), size: reason.sum.total, text: formatNumber(reason.sum.total) }))} />
        <BarTable caption={words("admin.journeys.refused")} head={[words("admin.journeys.why"), words("admin.count")]} bars={refused.map((reason) => ({ label: reason.key, size: reason.sum.total, text: formatNumber(reason.sum.total) }))} />
      </div>
      <Note>{words("admin.sum.note")}</Note>
    </Card>
  );
}

function AsOf({ shared }: { shared: Shared }) {
  const [typed, setTyped] = useState(shared.day ?? "");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        shared.setDay(typed === "" ? null : typed);
      }}
    >
      <Field label={words("admin.asof")} hint={words("admin.asof.hint")} value={typed} onChange={(event) => setTyped(event.target.value)} />
      <Button small type="submit" disabled={typed !== "" && !DATE.test(typed)}>
        {words("admin.show")}
      </Button>
    </form>
  );
}

export function PlayersSection({ shared }: { shared: Shared }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.players")}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <AsOf shared={shared} />
          <PeriodPicker value={shared.period} onChange={shared.setPeriod} />
        </div>
      </div>
      <Loaded reply={shared.stats.reply}>
        {({ stats }) => {
          const figures = periodOf(stats, shared.period);
          return (
            <Stats>
              <Stat label={words("admin.figure.accounts")} value={shownCount(stats.totals.players.all)} note={words("admin.figure.accounts.note", { day: dayWords(stats.totals.day) })} />
              <Stat label={words("admin.figure.newPlayers")} value={shownCount(figures.newPlayers.all)} note={words(`admin.period.${shared.period}`)} />
              <Stat label={words("admin.figure.secured")} value={shownCount(figures.secured)} note={words("admin.figure.secured.note", { rate: rateWords(figures.rates.securedPerGuestBp) })} />
              <Stat label={words("admin.figure.sessions")} value={shownCount(figures.sessions)} note={words("admin.figure.sessions.note", { rate: rateWords(figures.rates.sessionsPerPlayerBp) })} />
            </Stats>
          );
        }}
      </Loaded>
      <div className="grid gap-4 lg:grid-cols-2">
        <Loaded reply={shared.dashboard.reply}>
          {({ dashboard }) => (
            <>
              <Card title={words("admin.chart.new")} subtitle={words("admin.window", { from: dayWords(dashboard.from), to: dayWords(dashboard.day) })}>
                <AreaChart title={words("admin.chart.new")} values={dailySeries(dashboard.daily, "newPlayers")} labels={windowLabels(dashboard, dayWords)} />
                <Note>{words("admin.chart.hidden", { floor: formatNumber(dashboard.minShown) })}</Note>
              </Card>
              <Card title={words("admin.early")} subtitle={words("admin.early.note")}>
                <BarTable
                  caption={words("admin.early")}
                  hideCaption
                  head={[words("admin.early.turn"), words("admin.figure.newPlayers")]}
                  bars={EARLY.map((key) => {
                    const total = dashboard.weeks.reduce<number | null>((sum, week) => (sum === null ? null : shownNumber(week.earlyWin[key] ?? { fewerThan: dashboard.minShown }) === null ? null : sum + (shownNumber(week.earlyWin[key] ?? 0) ?? 0)), 0);
                    return { label: words(`admin.early.${key}`), size: total, text: total === null ? words("admin.fewer", { count: dashboard.minShown }) : formatNumber(total) };
                  })}
                />
                <p className="text-sm" data-asked-early={dashboard.askedEarly.length > 0 ? "alarm" : "ok"}>
                  {dashboard.askedEarly.length === 0
                    ? words("admin.early.asked.none")
                    : words("admin.early.asked", { count: formatNumber(dashboard.askedEarly.reduce((sum, row) => sum + row.count, 0)), days: dashboard.askedEarly.map((row) => dayWords(row.day)).filter((day, at, all) => all.indexOf(day) === at).join(", ") })}
                </p>
              </Card>
            </>
          )}
        </Loaded>
        <Loaded reply={shared.stats.reply}>
          {({ stats }) => (
            <>
              <Card title={words("admin.funnel")} subtitle={words("admin.window", { from: dayWords(stats.funnel.from), to: dayWords(stats.funnel.to) })}>
                <BarTable caption={words("admin.funnel")} hideCaption head={[words("admin.funnel.step"), words("admin.funnel.share")]} bars={stats.funnel.steps.map((step) => ({ label: maybe(`admin.funnel.${step.step}`, step.step), size: shownNumber(step.count), text: `${shownCount(step.count)} ${step.ofFirstBp === null ? "" : `(${rateWords(step.ofFirstBp)})`}`.trim() }))} />
              </Card>
              <Card title={words("admin.sessions")} subtitle={words("admin.window", { from: dayWords(stats.sessions.from), to: dayWords(stats.sessions.to) })}>
                <BarTable caption={words("admin.sessions")} hideCaption head={[words("admin.sessions.length"), words("admin.count")]} bars={Object.entries(stats.sessions.lengths).map(([band, count]) => ({ label: maybe(`admin.session.${band}`, band), size: shownNumber(count), text: shownCount(count) }))} />
                <Note>{words("admin.sessions.note", { count: shownCount(stats.sessions.count), rate: rateWords(stats.sessions.perPlayerBp) })}</Note>
              </Card>
              <Card title={words("admin.shares")} subtitle={words("admin.window", { from: dayWords(stats.shares.from), to: dayWords(stats.shares.to) })}>
                <Table caption={words("admin.shares")} hideCaption head={[words("admin.shares.kind"), words("admin.shares.pressed"), words("admin.shares.completed")]} rows={stats.shares.kinds.map((kind) => [maybe(`admin.share.${kind.kind}`, kind.kind), shownCount(kind.pressed), shownCount(kind.completed)])} />
              </Card>
            </>
          )}
        </Loaded>
        {shared.stats.reply?.ok === true && shared.dashboard.reply?.ok === true ? <ReturnTable stats={shared.stats.reply.stats} dashboard={shared.dashboard.reply.dashboard} /> : null}
        {shared.dashboard.reply?.ok === true ? <Journeys dashboard={shared.dashboard.reply.dashboard} /> : null}
      </div>
    </>
  );
}

