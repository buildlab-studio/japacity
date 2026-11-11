// Money (admin:sections-alarms-first, server:daily-money-report, lottery:money-report-checks-draws,
// server:rollback-check-finds-divergence): the period's revenue and top-ups, the economy by month played and naira held,
// the day's ledger, the draws, and the rollback check, which reads only; nothing here corrects, freezes or rolls back a
// character (server:no-mass-rollback).
import type { ByReason, RollbackCheck } from "@japacity/api";
import { isCurrency, time } from "@japacity/sim";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { HeatGrid } from "./admin.charts";
import { dayWords, nairaWords, shownCount, shownNumber } from "./admin.format";
import { counterSum, periodOf } from "./admin.series";
import { maybe, words } from "./admin.words";
import type { Shared } from "./AdminPage";
import { alarmWords } from "./HealthSection";
import { Card, Confirm, Field, Loaded, Note, PeriodPicker, Pill, ReloadButton, Stat, Stats, stateWords, Table, useLoad } from "./admin.ui";

function money(amount: number, currency: string): string {
  return isCurrency(currency) ? formatMoney(amount, currency) : formatNumber(amount);
}

function moneyRows(totals: ByReason): string[][] {
  const rows: string[][] = [];
  for (const [reason, byCurrency] of Object.entries(totals)) {
    for (const [currency, amount] of Object.entries(byCurrency ?? {})) rows.push([reason, currency, money(amount ?? 0, currency), formatNumber(amount ?? 0)]);
  }
  return rows;
}

const MONEY_HEAD = [words("admin.money.reason"), words("admin.money.currency"), words("admin.money.amount"), words("admin.money.minor")];

function Ledger({ shared }: { shared: Shared }) {
  const [typed, setTyped] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const report = useLoad(() => shared.api.report(day));
  const asked = typed === "" ? null : time.dayNumber(typed);
  return (
    <Card title={words("admin.money.report")} action={<ReloadButton onClick={report.reload} />} span>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setDay(asked);
          report.reload();
        }}
      >
        <Field label={words("admin.money.day")} hint={words("admin.money.day.hint")} value={typed} onChange={(event) => setTyped(event.target.value)} />
        <Button small type="submit" disabled={typed !== "" && asked === null}>
          {words("admin.show")}
        </Button>
      </form>
      <Loaded reply={report.reply}>
        {({ report: row }) => (
          <>
            <p className="text-sm text-text-2">{words("admin.money.for", { day: dayWords(time.dayName(row.day), true) })}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Table caption={words("admin.money.created")} head={MONEY_HEAD} rows={moneyRows(row.created)} />
              <Table caption={words("admin.money.destroyed")} head={MONEY_HEAD} rows={moneyRows(row.destroyed)} />
            </div>
          </>
        )}
      </Loaded>
    </Card>
  );
}

/** One rollback check's answer, also shown when a report is closed with `rollback` (moderation:rollback-through-admin-view). */
export function RollbackAnswer({ check }: { check: RollbackCheck }) {
  if (!check.ok) return <p className="text-sm text-bad">{words("admin.refused.code", { code: check.code, detail: check.detail })}</p>;
  const { report } = check;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{words("admin.rollback.summary", { character: report.character, v: report.v, replayed: report.replayed })}</p>
      <p className={report.firstDiff === null ? "" : "font-semibold text-bad"}>
        {report.firstDiff === null
          ? words("admin.rollback.clean")
          : words("admin.rollback.diff", { v: report.firstDiff.v, stored: report.firstDiff.stored, replayed: report.firstDiff.replayed ?? words("admin.none") })}
      </p>
      <Table caption={words("admin.rollback.dropped")} head={[words("admin.rollback.version"), words("admin.rollback.type"), words("admin.rollback.code"), words("admin.rollback.detail")]} rows={report.dropped.map((each) => [String(each.v), each.type, each.code, each.detail])} />
    </div>
  );
}

function Rollback({ shared }: { shared: Shared }) {
  const [character, setCharacter] = useState(shared.character);
  const id = character.trim();
  return (
    <Card title={words("admin.rollback.title")} subtitle={words("admin.rollback.intro")} data-rollback="">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={words("admin.rollback.character")} value={character} onChange={(event) => setCharacter(event.target.value)} />
      </div>
      <Confirm label={words("admin.rollback.run")} summary={words("admin.rollback.confirm", { character: id })} blocked={id === "" ? words("admin.rollback.character") : null} send={() => shared.api.rollback(id)} done={(check) => <RollbackAnswer check={check} />} />
    </Card>
  );
}

function Draws({ shared }: { shared: Shared }) {
  return (
    <Card title={words("admin.draws")} subtitle={words("admin.draws.note")}>
      <Loaded reply={shared.checks.reply}>
        {({ checks }) => {
          const check = checks.find((each) => each.check === "draw-payouts");
          if (check === undefined) return <p className="text-sm text-text-2">{words("admin.no-data")}</p>;
          const alarms = check.found.kind === "alarms" ? check.found.alarms : [];
          return (
            <>
              <div>
                <Pill tone={check.state}>{stateWords(check.state)}</Pill>
              </div>
              {alarms.length === 0 ? (
                <p className="text-sm text-text-2">{words("admin.draws.clean")}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {alarms.map((alarm, at) => (
                    <li key={at}>{alarmWords(alarm)}</li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </Loaded>
    </Card>
  );
}

export function MoneySection({ shared }: { shared: Shared }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.money")}</h2>
        <PeriodPicker value={shared.period} onChange={shared.setPeriod} />
      </div>
      <Loaded reply={shared.stats.reply}>
        {({ stats }) => {
          const figures = periodOf(stats, shared.period);
          const tickets = shared.dashboard.reply?.ok === true ? counterSum(shared.dashboard.reply.dashboard.counters, "lottery/tickets") : null;
          return (
            <Stats>
              <Stat label={words("admin.figure.revenue")} value={nairaWords(stats.adverts.revenueKobo)} note={words("admin.window", { from: dayWords(stats.adverts.from), to: dayWords(stats.adverts.to) })} />
              <Stat label={words("admin.figure.revenue.per")} value={nairaWords(stats.adverts.revenuePerPlayerKobo)} note={words("admin.figure.revenue.per.note")} />
              <Stat label={words("admin.figure.topUps")} value={shownCount(figures.topUps)} note={words("admin.figure.topUps.note", { amount: nairaWords(figures.topUpKobo) })} />
              <Stat label={words("admin.figure.tickets")} value={tickets === null ? words("admin.no-data") : formatNumber(tickets.total)} note={words("admin.figure.tickets.note")} />
            </Stats>
          );
        }}
      </Loaded>
      <div className="grid gap-4 lg:grid-cols-2">
        <Loaded reply={shared.stats.reply}>
          {({ stats }) => {
            const held = [...new Set(stats.economy.cells.map((cell) => cell.held))];
            const months = [...new Set(stats.economy.cells.map((cell) => cell.months))];
            return (
              <Card title={words("admin.economy")} subtitle={words("admin.economy.note", { day: dayWords(stats.economy.day) })}>
                <HeatGrid
                  caption={words("admin.economy")}
                  corner={words("admin.economy.months")}
                  rows={months.map((key) => ({ key, label: maybe(`admin.months.${key}`, key) }))}
                  columns={held.map((key) => ({ key, label: maybe(`admin.held.${key}`, key) }))}
                  cells={stats.economy.cells.map((cell) => ({ row: cell.months, column: cell.held, text: shownCount(cell.lives), size: shownNumber(cell.lives) }))}
                />
                <Note>{words("admin.economy.cells")}</Note>
              </Card>
            );
          }}
        </Loaded>
        <Draws shared={shared} />
        <Ledger shared={shared} />
        <Rollback shared={shared} />
      </div>
    </>
  );
}
