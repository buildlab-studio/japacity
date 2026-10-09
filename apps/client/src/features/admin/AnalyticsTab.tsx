// The launch dashboard's data (R-ANALYTICS-009 to 011): the daily series and
// the sign-up weeks as tables beside the reference lines. A count the server
// hid under `minShown` shows only as "fewer than" (R-ANALYTICS-010).
import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { formatBp } from "../../shared/words/format";
import { rate, shownCount } from "./admin.format";
import { words } from "./admin.words";
import type { AdminApi } from "./api";
import { Field, Loaded, ReloadButton, Section, Table, useLoad } from "./admin.ui";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EARLY_WIN = ["1", "2", "3", "later", "none"] as const;

export function AnalyticsTab({ api }: { api: AdminApi }) {
  const [typed, setTyped] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const dashboard = useLoad(() => api.analytics(day));
  return (
    <Section title={words("admin.tab.analytics")} action={<ReloadButton onClick={dashboard.reload} />}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setDay(typed === "" ? null : typed);
          dashboard.reload();
        }}
      >
        <Field label={words("admin.analytics.day")} hint={words("admin.analytics.day.hint")} value={typed} onChange={(event) => setTyped(event.target.value)} />
        <Button small type="submit" disabled={typed !== "" && !DATE.test(typed)}>
          {words("admin.analytics.show")}
        </Button>
      </form>
      <Loaded reply={dashboard.reply}>
        {({ dashboard: data }) => (
          <div className="flex flex-col gap-6">
            <p>{words("admin.analytics.window", { from: data.from, day: data.day, minShown: data.minShown })}</p>
            {data.askBeforeEarlyWin ? (
              <p role="alert" data-fault="ask-before-early-win" className="rounded-md border-2 border-bad p-3 font-semibold text-bad">
                {words("admin.analytics.ask")}
              </p>
            ) : null}
            <Table
              caption={words("admin.analytics.daily")}
              head={[words("admin.analytics.col.day"), words("admin.analytics.col.players"), words("admin.analytics.col.new"), words("admin.analytics.col.turns")]}
              rows={data.daily.map((row) => [row.day, shownCount(row.players), shownCount(row.newPlayers), shownCount(row.turnsEnded)])}
            />
            <p>{words("admin.analytics.reference", { d1: formatBp(data.reference.d1Bp), d7: formatBp(data.reference.d7Bp) })}</p>
            <Table
              caption={words("admin.analytics.weeks")}
              head={[
                words("admin.analytics.col.week"),
                words("admin.analytics.col.new"),
                words("admin.analytics.col.d1"),
                words("admin.analytics.col.d1Bp"),
                words("admin.analytics.col.d7"),
                words("admin.analytics.col.d7Bp"),
                ...EARLY_WIN.map((key) => words("admin.analytics.col.early", { key })),
              ]}
              rows={data.weeks.map((week) => [
                week.week,
                shownCount(week.newPlayers),
                shownCount(week.d1),
                rate(week.d1Bp, data.reference.d1Bp),
                shownCount(week.d7),
                rate(week.d7Bp, data.reference.d7Bp),
                ...EARLY_WIN.map((key) => shownCount(week.earlyWin[key] ?? { fewerThan: data.minShown })),
              ])}
            />
            <details>
              <summary className="cursor-pointer font-semibold">{words("admin.analytics.counters")}</summary>
              <Table
                caption={words("admin.analytics.counters")}
                head={[words("admin.analytics.col.day"), words("admin.analytics.col.region"), words("admin.analytics.col.name"), words("admin.analytics.col.key"), words("admin.analytics.col.count")]}
                rows={data.counters.map((row) => [row.day, row.region, row.name, row.key, shownCount(row.count)])}
              />
            </details>
          </div>
        )}
      </Loaded>
    </Section>
  );
}
