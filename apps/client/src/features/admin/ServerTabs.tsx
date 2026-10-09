// The money report and its alarms (R-SERVER-011, R-SERVER-012), the rejection
// counts (R-SERVER-005) and the rollback check (R-SERVER-008). The check reads
// only; nothing here corrects, freezes or rolls back a character (R-SERVER-010).
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { formatMoney, formatNumber, isCurrency } from "../../shared/words/format";
import type { Alarm, ByReason, RollbackCheck } from "./admin.contract";
import { dayOf, utcDate } from "./admin.format";
import { words } from "./admin.words";
import type { AdminApi } from "./api";
import { Confirm, Field, Loaded, ReloadButton, Section, Table, useLoad } from "./admin.ui";

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

function alarmWords(alarm: Alarm): string {
  const day = utcDate(alarm.day);
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

export function MoneyTab({ api, onRollback }: { api: AdminApi; onRollback: (character: string) => void }) {
  const [typed, setTyped] = useState("");
  const [day, setDay] = useState<number | null>(null);
  const report = useLoad(() => api.report(day));
  const alarms = useLoad(() => api.alarms());
  const asked = typed === "" ? null : dayOf(typed);
  return (
    <div className="flex flex-col gap-8">
      <Section title={words("admin.money.report")} action={<ReloadButton onClick={report.reload} />}>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setDay(asked);
            report.reload();
          }}
        >
          <Field label={words("admin.money.day")} hint={words("admin.money.day.hint")} value={typed} onChange={(event) => setTyped(event.target.value)} />
          <Button small type="submit" disabled={typed !== "" && asked === null}>
            {words("admin.money.show")}
          </Button>
        </form>
        <Loaded reply={report.reply}>
          {({ report: row }) => (
            <>
              <p>{words("admin.money.for", { day: utcDate(row.day) })}</p>
              <Table caption={words("admin.money.created")} head={MONEY_HEAD} rows={moneyRows(row.created)} />
              <Table caption={words("admin.money.destroyed")} head={MONEY_HEAD} rows={moneyRows(row.destroyed)} />
            </>
          )}
        </Loaded>
      </Section>
      <Section title={words("admin.money.alarms")} action={<ReloadButton onClick={alarms.reload} />}>
        <Loaded reply={alarms.reply}>
          {({ alarms: list }) =>
            list.length === 0 ? (
              <p className="text-text-2">{words("admin.money.alarms.none")}</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label={words("admin.money.alarms")}>
                {list.map((alarm, at) => (
                  <li key={at} className="flex flex-wrap items-center gap-3 rounded-md border border-bad p-3">
                    <span className="flex-1">{alarmWords(alarm)}</span>
                    {alarm.kind === "draw" ? null : (
                      <Button small onClick={() => onRollback(alarm.character)}>
                        {words("admin.alarm.check", { character: alarm.character })}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </Loaded>
      </Section>
    </div>
  );
}

export function RejectionsTab({ api }: { api: AdminApi }) {
  const counts = useLoad(() => api.rejections());
  return (
    <Section title={words("admin.rejections.title")} action={<ReloadButton onClick={counts.reload} />}>
      <p className="text-text-2">{words("admin.rejections.note")}</p>
      <Loaded reply={counts.reply}>
        {({ counts: byCode }) => (
          <Table
            caption={words("admin.rejections.title")}
            head={[words("admin.rejections.code"), words("admin.rejections.count")]}
            rows={Object.entries(byCode)
              .sort(([one], [two]) => one.localeCompare(two))
              .map(([code, count]) => [code, formatNumber(count)])}
          />
        )}
      </Loaded>
    </Section>
  );
}

/** One rollback check's answer, also shown when a report is closed with `rollback` (R-MODERATION-019). */
export function RollbackAnswer({ check }: { check: RollbackCheck }) {
  if (!check.ok) return <p className="text-bad">{words("admin.refused.code", { code: check.code, detail: check.detail })}</p>;
  const { report } = check;
  return (
    <div className="flex flex-col gap-2">
      <p>{words("admin.rollback.summary", { character: report.character, v: report.v, replayed: report.replayed })}</p>
      <p className={report.firstDiff === null ? "" : "font-semibold text-bad"}>
        {report.firstDiff === null
          ? words("admin.rollback.clean")
          : words("admin.rollback.diff", { v: report.firstDiff.v, stored: report.firstDiff.stored, replayed: report.firstDiff.replayed ?? words("admin.none") })}
      </p>
      <Table
        caption={words("admin.rollback.dropped")}
        head={[words("admin.rollback.version"), words("admin.rollback.type"), words("admin.rollback.code"), words("admin.rollback.detail")]}
        rows={report.dropped.map((each) => [String(each.v), each.type, each.code, each.detail])}
      />
    </div>
  );
}

export function RollbackTab({ api, character: given }: { api: AdminApi; character: string }) {
  const [character, setCharacter] = useState(given);
  const id = character.trim();
  return (
    <Section title={words("admin.rollback.title")}>
      <p className="text-text-2">{words("admin.rollback.intro")}</p>
      <Field label={words("admin.rollback.character")} value={character} onChange={(event) => setCharacter(event.target.value)} />
      <Confirm
        label={words("admin.rollback.run")}
        summary={words("admin.rollback.confirm", { character: id })}
        blocked={id === "" ? words("admin.rollback.character") : null}
        send={() => api.rollback(id)}
        done={(check) => <RollbackAnswer check={check} />}
      />
    </Section>
  );
}
