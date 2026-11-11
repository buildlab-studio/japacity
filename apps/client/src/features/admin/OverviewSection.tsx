// Overview (admin:sections-alarms-first, admin:period-is-today-7-or-30): the period's figures as cards with their change
// against the previous period, what is waiting for a person, and players a day over the window.
import { formatNumber } from "../../shared/words/format";
import { AreaChart } from "./admin.charts";
import { changeWords, dayWords, nairaWords, rateWords, shownCount } from "./admin.format";
import { dailySeries, periodChange, periodOf, windowLabels } from "./admin.series";
import { words } from "./admin.words";
import { campaignWaiting, type AdminSection, type Shared } from "./AdminPage";
import { Card, Loaded, PeriodPicker, Stat, Stats, useLoad } from "./admin.ui";

function Change({ now, before }: { now: number | null; before: number | null }) {
  const change = changeWords(now, before);
  if (change === null) return <>{words("admin.change.none")}</>;
  const tone = change.startsWith("+") ? "text-good" : change.startsWith("-") ? "text-bad" : "";
  return (
    <>
      <span className={`font-medium ${tone}`}>{change}</span> {words("admin.change.previous")}
    </>
  );
}

function Tile({ count, label, to, shared }: { count: number | null; label: string; to: AdminSection; shared: Shared }) {
  const figure = count === null ? words("admin.no-data") : formatNumber(count);
  return (
    <li>
      <button type="button" onClick={() => shared.open(to)} className={`flex w-full flex-col items-start gap-0.5 rounded-xl border border-sheet-line bg-sheet-2 px-3 py-2.5 text-left transition-colors hover:bg-sheet-muted ${count === 0 ? "text-text-2" : ""}`}>
        <span className={`text-xl font-semibold tabular-nums ${count !== null && count > 0 ? "text-(--accent-text)" : ""}`}>{figure}</span>
        <span className="text-xs text-text-2">{label}</span>
      </button>
    </li>
  );
}

function Waiting({ shared }: { shared: Shared }) {
  const lights = useLoad(() => shared.api.pendingLights());
  const feedback = useLoad(() => shared.api.feedback());
  const queue = shared.queue.reply?.ok === true ? shared.queue.reply.queue.items : null;
  const campaigns = shared.campaigns.reply?.ok === true ? shared.campaigns.reply.campaigns : null;
  return (
    <Card title={words("admin.waiting")}>
      <ul aria-label={words("admin.waiting")} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Tile count={queue === null ? null : queue.filter((item) => item.kind === "report").length} label={words("admin.waiting.reports")} to="moderation" shared={shared} />
        <Tile count={queue === null ? null : queue.filter((item) => item.kind === "appeal").length} label={words("admin.waiting.appeals")} to="moderation" shared={shared} />
        <Tile count={lights.reply?.ok === true ? lights.reply.lights.length : null} label={words("admin.waiting.lights")} to="moderation" shared={shared} />
        <Tile count={campaigns === null ? null : campaigns.filter(campaignWaiting).length} label={words("admin.waiting.adverts")} to="adverts" shared={shared} />
        <Tile count={feedback.reply?.ok === true ? feedback.reply.feedback.length : null} label={words("admin.waiting.feedback")} to="moderation" shared={shared} />
      </ul>
    </Card>
  );
}

export function OverviewSection({ shared }: { shared: Shared }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.overview")}</h2>
        <PeriodPicker value={shared.period} onChange={shared.setPeriod} />
      </div>
      <Loaded reply={shared.stats.reply}>
        {({ stats }) => {
          const figures = periodOf(stats, shared.period);
          const rows = shared.dashboard.reply?.ok === true ? shared.dashboard.reply.dashboard.daily : [];
          const week = stats.retention.weeks.at(-1);
          const reference = shared.dashboard.reply?.ok === true ? shared.dashboard.reply.dashboard.reference : null;
          return (
            <Stats>
              <Stat label={words("admin.figure.players")} value={shownCount(figures.players.all)} note={<Change {...periodChange(rows, "players", shared.period)} />} />
              <Stat label={words("admin.figure.newPlayers")} value={shownCount(figures.newPlayers.all)} note={<Change {...periodChange(rows, "newPlayers", shared.period)} />} />
              <Stat label={words("admin.figure.turnsEnded")} value={shownCount(figures.turnsEnded)} note={<Change {...periodChange(rows, "turnsEnded", shared.period)} />} />
              <Stat label={words("admin.figure.d1")} value={rateWords(week?.returned.d1.bp ?? null)} note={week === undefined ? words("admin.no-data") : words("admin.figure.week", { week: dayWords(week.week), line: reference === null ? "" : rateWords(reference.d1Bp) })} />
              <Stat label={words("admin.figure.d7")} value={rateWords(week?.returned.d7.bp ?? null)} note={week === undefined ? words("admin.no-data") : words("admin.figure.week", { week: dayWords(week.week), line: reference === null ? "" : rateWords(reference.d7Bp) })} />
              <Stat label={words("admin.figure.revenue")} value={nairaWords(stats.adverts.revenueKobo)} note={words("admin.figure.revenue.note", { per: nairaWords(stats.adverts.revenuePerPlayerKobo) })} />
              <Stat label={words("admin.figure.online")} value={shownCount(stats.now.online.all)} note={words("admin.figure.peak", { peak: shownCount(stats.now.peakToday.all) })} />
              <Stat label={words("admin.figure.departed")} value={shownCount(figures.departed)} note={words("admin.figure.departed.note", { rate: rateWords(figures.rates.departedPerNewBp) })} />
            </Stats>
          );
        }}
      </Loaded>
      <Waiting shared={shared} />
      <Card title={words("admin.chart.players")} subtitle={words("admin.chart.players.note")}>
        <Loaded reply={shared.dashboard.reply}>
          {({ dashboard }) => <AreaChart title={words("admin.chart.players")} values={dailySeries(dashboard.daily, "players")} thin={dailySeries(dashboard.daily, "newPlayers")} labels={windowLabels(dashboard, dayWords)} />}
        </Loaded>
        <p className="text-xs text-text-2">{words("admin.chart.hidden", { floor: shared.dashboard.reply?.ok === true ? formatNumber(shared.dashboard.reply.dashboard.minShown) : "" })}</p>
      </Card>
      <Loaded reply={shared.stats.reply}>{({ stats }) => <p className="text-xs text-text-2">{words("admin.read", { to: dayWords(stats.last30.to, true) })}</p>}</Loaded>
    </>
  );
}
