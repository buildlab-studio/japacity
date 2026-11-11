// Health (admin:sections-alarms-first, admin:checks-have-three-states, admin:check-handled-with-reason): a headline that
// says all clear or how many are in alarm, one row per check with its state, its value against its limit and since when,
// a detail that says what it means and what to do and lists what it found, and the server's figures under them
// (server:rejections-write-nothing).
import type { Alarm, CheckView } from "@japacity/api";
import { CHECK_NAMES } from "@japacity/api";
import { isCurrency, time } from "@japacity/sim";
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { counterByKey, counterSum, periodOf } from "./admin.series";
import { dayWords, duration, shownCount, whenWords } from "./admin.format";
import { words, type AdminKey } from "./admin.words";
import type { Shared } from "./AdminPage";
import { BarTable, Card, Loaded, Note, PeriodPicker, Pill, ReasonDialog, ReloadButton, Stat, Stats, stateWords, useLoad } from "./admin.ui";

function money(amount: number, currency: string): string {
  return isCurrency(currency) ? formatMoney(amount, currency) : formatNumber(amount);
}

/** server:ledger-alarm-lists-suspects: one alarm's line. */
export function alarmWords(alarm: Alarm): string {
  const day = dayWords(time.dayName(alarm.day));
  switch (alarm.kind) {
    case "suspect":
      return words("admin.alarm.suspect", { day, character: alarm.character, reason: alarm.reason, currency: alarm.currency, total: money(alarm.total, alarm.currency), ceiling: money(alarm.ceiling, alarm.currency) });
    case "draw":
      return words("admin.alarm.draw", { day, draw: alarm.draw, check: alarm.check, total: formatNumber(alarm.total), limit: formatNumber(alarm.limit) });
    case "diverged":
      return words("admin.alarm.diverged", { day, character: alarm.character, v: alarm.v });
    default: {
      const never: never = alarm;
      return never;
    }
  }
}

function valueWords(check: CheckView): string {
  if (check.found.kind === "day") return dayWords(check.found.day);
  return check.value === null ? words("admin.no-data") : words("admin.check.value", { value: formatNumber(check.value), limit: formatNumber(check.limit) });
}

function Found({ check, shared }: { check: CheckView; shared: Shared }) {
  const { found } = check;
  switch (found.kind) {
    case "alarms":
      return found.alarms.length === 0 ? (
        <p className="text-sm text-text-2">{words("admin.check.found.none")}</p>
      ) : (
        <ul aria-label={words("admin.check.found")} className="flex flex-col gap-1.5">
          {found.alarms.map((alarm, at) => (
            <li key={at} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{alarmWords(alarm)}</span>
              {alarm.kind === "draw" ? null : (
                <Button small variant="quiet" onClick={() => shared.open("money", alarm.character)}>
                  {words("admin.alarm.check", { character: alarm.character })}
                </Button>
              )}
            </li>
          ))}
        </ul>
      );
    case "asks":
      return found.rows.length === 0 ? (
        <p className="text-sm text-text-2">{words("admin.check.found.none")}</p>
      ) : (
        <ul aria-label={words("admin.check.found")} className="flex flex-col gap-1 text-sm">
          {found.rows.map((row) => (
            <li key={`${row.day} ${row.name} ${row.key}`}>{words("admin.check.ask", { day: dayWords(row.day), ask: row.key.replace(/:before$/, ""), what: row.name === "ask/shown" ? words("admin.check.ask.shown") : words("admin.check.ask.accepted"), count: formatNumber(row.count) })}</li>
          ))}
        </ul>
      );
    case "queue":
      return (
        <p className="flex flex-wrap items-center gap-x-3 text-sm">
          <span>{words("admin.check.queue", { overdue: formatNumber(found.overdue), oldest: duration(found.oldest), target: duration(found.target) })}</span>
          <Button small variant="quiet" onClick={() => shared.open("moderation")}>
            {words("admin.section.moderation")}
          </Button>
        </p>
      );
    case "day":
      return <p className="text-sm">{words(found.counted ? "admin.check.day.counted" : "admin.check.day.missing", { day: dayWords(found.day) })}</p>;
    default: {
      const never: never = found;
      return never;
    }
  }
}

function CheckRow({ check, shared }: { check: CheckView; shared: Shared }) {
  const [open, setOpen] = useState(false);
  const [handling, setHandling] = useState(false);
  const name = words(`admin.check.${check.check}` as AdminKey);
  return (
    <li data-check={check.check} data-state={check.state} className="flex flex-col">
      <div className={`flex items-center gap-3 py-2.5 ${open ? "" : "border-b border-sheet-line"}`}>
        <Pill tone={check.state} data-state={check.state}>
          {stateWords(check.state)}
        </Pill>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{name}</span>
          <span className="block text-xs text-text-2">{words(`admin.check.${check.check}.what` as AdminKey)}</span>
        </span>
        <span className="shrink-0 text-sm tabular-nums">{valueWords(check)}</span>
        <span className="hidden w-32 shrink-0 text-right text-xs text-text-2 sm:block">{check.since === null ? "" : words("admin.check.since", { when: whenWords(check.since) })}</span>
        <button type="button" aria-expanded={open} aria-label={words(open ? "admin.check.close" : "admin.check.open", { name })} onClick={() => setOpen(!open)} className="grid size-8 shrink-0 place-items-center rounded-md text-text-2 hover:bg-sheet-muted">
          <span aria-hidden="true" className={`inline-block transition-transform ${open ? "rotate-180" : ""}`}>
            &#8964;
          </span>
        </button>
      </div>
      {open ? (
        <div className="admin-reveal mb-3 flex flex-col gap-3 rounded-lg bg-sheet p-3">
          <p className="text-sm">{words(`admin.check.${check.check}.do` as AdminKey)}</p>
          <Found check={check} shared={shared} />
          {check.history.length === 0 ? null : (
            <ol aria-label={words("admin.check.history")} className="flex flex-col gap-0.5 text-xs text-text-2">
              {check.history.map((change) => (
                <li key={change.at}>
                  {change.admin === undefined
                    ? words("admin.check.change", { when: whenWords(change.at), state: stateWords(change.state) })
                    : words("admin.check.handled", { when: whenWords(change.at), admin: change.admin, reason: change.reason ?? "" })}
                </li>
              ))}
            </ol>
          )}
          {check.state === "alarm" ? (
            <div>
              <Button small onClick={() => setHandling(true)}>
                {words("admin.check.handle")}
              </Button>
              <ReasonDialog
                open={handling}
                onOpenChange={setHandling}
                act={words("admin.check.handle.act", { name })}
                summary={words("admin.check.handle.summary", { name })}
                reasonLabel={words("admin.switch.reason")}
                reasonFor={words("admin.check.handle.for", { name })}
                example={words("admin.check.handle.example")}
                send={(reason) => shared.api.handleCheck(check.check, reason)}
                onDone={() => shared.checks.reload()}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Headline({ checks }: { checks: readonly CheckView[] }) {
  const inAlarm = checks.filter((check) => check.state === "alarm").length;
  const ok = checks.filter((check) => check.state === "ok").length;
  const noData = checks.length - inAlarm - ok;
  return (
    <Card data-headline={inAlarm > 0 ? "alarm" : "clear"}>
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${inAlarm > 0 ? "bg-bad text-white" : "bg-good text-white"}`}>
          {inAlarm > 0 ? inAlarm : "✓"}
        </span>
        <div>
          <p className="text-xl font-bold">{inAlarm > 0 ? words("admin.health.alarm", { count: inAlarm }) : words("admin.health.clear")}</p>
          <p className="text-sm text-text-2">{words("admin.health.counts", { ok, noData })}</p>
        </div>
      </div>
    </Card>
  );
}

function Server({ shared }: { shared: Shared }) {
  const rejections = useLoad(() => shared.api.rejections());
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{words("admin.server")}</h2>
        <PeriodPicker value={shared.period} onChange={shared.setPeriod} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={words("admin.rejections.title")} subtitle={words("admin.rejections.note")} action={<ReloadButton onClick={rejections.reload} />}>
          <Loaded reply={rejections.reply}>
            {({ counts }) => {
              const bars = Object.entries(counts)
                .sort(([one, a], [two, b]) => b - a || one.localeCompare(two))
                .map(([code, count]) => ({ label: code, size: count, text: formatNumber(count) }));
              return <BarTable caption={words("admin.rejections.title")} head={[words("admin.rejections.code"), words("admin.rejections.count")]} bars={bars} hideCaption />;
            }}
          </Loaded>
        </Card>
        <div className="flex flex-col gap-4">
          <Loaded reply={shared.stats.reply}>
            {({ stats }) => {
              const figures = periodOf(stats, shared.period);
              return (
                <Stats>
                  <Stat label={words("admin.server.errors")} value={shownCount(figures.clientErrors)} note={words("admin.server.errors.rate", { rate: figures.rates.errorsPerThousandSessions === null ? words("admin.no-data") : formatNumber(figures.rates.errorsPerThousandSessions) })} />
                  <Loaded reply={shared.dashboard.reply}>
                    {({ dashboard }) => {
                      const blocked = counterSum(dashboard.counters, "client/csp-blocked");
                      return <Stat label={words("admin.server.blocked")} value={blocked.empty ? "0" : formatNumber(blocked.total)} note={words("admin.server.blocked.note")} />;
                    }}
                  </Loaded>
                </Stats>
              );
            }}
          </Loaded>
          <Card title={words("admin.server.load")} subtitle={words("admin.server.window")}>
            <Loaded reply={shared.dashboard.reply}>
              {({ dashboard }) => {
                const bands = counterByKey(dashboard.counters, "load/time");
                return <BarTable caption={words("admin.server.load")} head={[words("admin.server.load.band"), words("admin.count")]} bars={bands.map((band) => ({ label: band.key, size: band.sum.total, text: formatNumber(band.sum.total) }))} hideCaption />;
              }}
            </Loaded>
            <Note>{words("admin.sum.note")}</Note>
          </Card>
        </div>
      </div>
    </>
  );
}

export function HealthSection({ shared }: { shared: Shared }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{words("admin.section.health")}</h2>
        <ReloadButton onClick={shared.checks.reload} />
      </div>
      <Loaded reply={shared.checks.reply}>
        {({ checks }) => {
          const ordered = CHECK_NAMES.map((name) => checks.find((check) => check.check === name)).filter((check): check is CheckView => check !== undefined);
          const byState = [...ordered].sort((one, two) => rank(one) - rank(two));
          return (
            <>
              <Headline checks={ordered} />
              <Card title={words("admin.checks")}>
                <ul aria-label={words("admin.checks")} className="flex flex-col">
                  {byState.map((check) => (
                    <CheckRow key={check.check} check={check} shared={shared} />
                  ))}
                </ul>
              </Card>
            </>
          );
        }}
      </Loaded>
      <Server shared={shared} />
    </>
  );
}

/** In alarm first, then no data, then OK. */
function rank(check: CheckView): number {
  return check.state === "alarm" ? 0 : check.state === "no-data" ? 1 : 2;
}
