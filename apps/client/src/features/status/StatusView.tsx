// The status held abroad (R-STATUS-010): what it is, what work it allows, the
// months left, the clock when it runs, the lawful months toward settling, the
// way up, and the renewal with its fees (R-STATUS-006). The clock, when it
// runs, is the loudest thing on the screen: the shell shows ClockBanner above every tab.
import type { Currency, PlayerView } from "@japacity/sim";
import { AlarmClock, BadgeCheck } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Meter } from "../../shared/ui/Meter";
import { Card, Panel, Tag } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { shortfall } from "../../shared/words/cost";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, hasWords, nameOf, say, sayCount, words } from "../../shared/words/text";

type Held = NonNullable<PlayerView["status"]>;

/** What renewing costs today, from the view (R-STATUS-010), or null when this status does not renew at the player's asking. */
export function renewal(held: Held): { months: number; currency: Currency; fee: number; surcharge: number } | null {
  return held.renew;
}

/** The clock in big type. Rendered in the status panel and above every tab while it runs. */
export function ClockBanner({ className = "" }: { className?: string }) {
  const view = useView();
  const clock = view.status?.clock ?? null;
  if (clock === null || view.status === null) return null;
  return (
    <div role="alert" data-clock className={`flex items-center gap-4 rounded-md bg-bad p-4 text-on-strong ${className}`}>
      <AlarmClock size={36} className="shrink-0" />
      <p className="font-display text-6xl leading-none tabular-nums">{clock}</p>
      <div className="flex flex-col">
        <p className="text-lg font-bold">{sayCount("ui.status.clock", clock, { months: clock })}</p>
        <p className="text-sm opacity-90">{say("ui.status.clock-why", { status: nameOf(view.status.entry) })}</p>
      </div>
    </div>
  );
}

function Renew({ held }: { held: Held }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [sure, setSure] = useState(false);
  const cost = renewal(held);
  if (cost === null) return null;
  const needsJob = held.work === "one-employer" && view.job.id === null;
  const gap = shortfall(view, [{ currency: cost.currency, amount: cost.fee + cost.surcharge }]);
  return (
    <div className="flex flex-col gap-2 border-t border-sheet-line pt-3" data-renew>
      <h4 className="text-sm font-semibold">{say("ui.status.renew-title", { months: cost.months })}</h4>
      <p className="text-sm tabular-nums">
        {say("ui.status.renew-fees", { fee: formatMoney(cost.fee, cost.currency), surcharge: formatMoney(cost.surcharge, cost.currency), total: formatMoney(cost.fee + cost.surcharge, cost.currency) })}
      </p>
      {gap.foreign && gap.need > 0 ? <p className="text-sm text-text-2">{say("ui.status.renew-naira", { naira: formatMoney(gap.need, "NGN") })}</p> : null}
      {gap.short > 0 ? <p className="text-sm text-bad">{say("ui.status.renew-short", { short: formatMoney(gap.short, "NGN") })}</p> : null}
      {needsJob ? <p className="text-sm text-bad">{say("ui.status.renew-needs-job")}</p> : null}
      <Rejection />
      {sure ? (
        <div className="flex flex-wrap gap-2">
          <Button
            small
            variant="primary"
            disabled={busy}
            onClick={() => {
              setSure(false);
              void send({ type: "status/renew" });
            }}
          >
            {say("ui.status.renew-yes", { total: formatMoney(cost.fee + cost.surcharge, cost.currency) })}
          </Button>
          <Button small onClick={() => setSure(false)}>
            {say("ui.place.go-no")}
          </Button>
        </div>
      ) : (
        <div>
          <Button small disabled={busy || view.ended || needsJob} onClick={() => setSure(true)}>
            {say("ui.status.renew")}
          </Button>
        </div>
      )}
      <p className="text-xs text-text-2">{say("ui.status.fee-note")}</p>
    </div>
  );
}

function Settling({ held }: { held: Held }) {
  if (held.settleMonths === null) return <p className="text-sm text-text-2">{say("ui.status.no-settle")}</p>;
  const label = say("ui.status.lawful", { months: held.lawfulMonths, need: held.settleMonths });
  return (
    <div className="flex flex-col gap-1" data-lawful>
      <p className="text-sm font-medium">{label}</p>
      <Meter value={held.lawfulMonths} max={held.settleMonths} label={label} tone="ink" />
    </div>
  );
}

export function StatusView() {
  const view = useView();
  const held = view.status;
  if (view.place.where !== "abroad") return null;
  return (
    <Panel title={say("ui.status.title")}>
      {held === null ? (
        <Card tone="attention">{say("ui.status.none")}</Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <BadgeCheck size={22} className="mt-0.5 shrink-0 text-text-2" />
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-lg font-semibold">{nameOf(held.entry)}</h3>
              {blurbOf(held.entry) === null ? null : <p className="text-sm text-text-2">{blurbOf(held.entry)}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {held.clock === null ? null : <Tag tone="bad">{sayCount("ui.status.clock", held.clock, { months: held.clock })}</Tag>}
            <Tag tone={held.work === "none" || held.work === "cash" ? "bad" : "plain"}>{say(`ui.status.work.${held.work}`)}</Tag>
            <Tag tone={held.monthsLeft !== null && held.monthsLeft <= 3 ? "bad" : "plain"}>
              {held.monthsLeft === null ? say("ui.status.no-end") : sayCount("ui.status.months-left", held.monthsLeft, { months: held.monthsLeft })}
            </Tag>
          </div>
          <Settling held={held} />
          {held.nextStep === null ? null : (
            <p className="text-sm">
              <span className="font-medium">{say("ui.status.next")} </span>
              {hasWords(held.nextStep) ? words(held.nextStep) : null}
            </p>
          )}
          <Renew held={held} />
        </Card>
      )}
    </Panel>
  );
}
