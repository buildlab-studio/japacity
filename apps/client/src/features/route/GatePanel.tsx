// The gate's own part of a route (docs/rules/route-gates.md): the sponsor and
// its salary against the bar, the points against the cut-off, the endorsement
// and its cooldown, the agent and the role. Nothing hidden is in the view, so
// nothing hidden is shown: no fraud, no draw.
import { content } from "@japacity/content";
import type { Currency, RouteGateView, RouteView } from "@japacity/sim";

import { useView } from "../../authority/GameProvider";
import { bondName } from "../../shared/sim/people";
import { Meter } from "../../shared/ui/Meter";
import { Tag } from "../../shared/ui/Panel";
import { formatMoney, formatNumber, monthEnding, playerMonth } from "../../shared/words/format";
import { hasWords, say } from "../../shared/words/text";

function employerWords(key: string): string {
  return hasWords(`ui.gate.employer.${key}`) ? say(`ui.gate.employer.${key}`) : say("ui.gate.employer.other");
}

/** The currency of the route's country: what its salary and funds are counted in. */
export function countryCurrency(route: RouteView): Currency {
  const country = content.route[route.id]?.country ?? null;
  return (country === null ? undefined : content.country[country]?.currency) ?? "GBP";
}

function Sponsor({ gate, currency }: { gate: Extract<RouteGateView, { gate: "sponsor" }>; currency: Currency }) {
  if (gate.employer === null) return <p className="text-sm text-muted">{say("ui.gate.sponsor.none")}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>{say("ui.gate.sponsor.who", { employer: employerWords(gate.employer) })}</p>
      {gate.salary === null ? null : <p className="font-medium tabular-nums">{say("ui.gate.sponsor.salary", { salary: formatMoney(gate.salary, currency) })}</p>}
      <div>
        <Tag tone={gate.underBar ? "bad" : "good"}>{say(gate.underBar ? "ui.gate.sponsor.under" : "ui.gate.sponsor.over")}</Tag>
      </div>
      {gate.underBar ? <p className="text-bad">{say("ui.gate.sponsor.under-why")}</p> : null}
    </div>
  );
}

function Points({ gate, month }: { gate: Extract<RouteGateView, { gate: "points" }>; month: number }) {
  const short = Math.max(0, gate.cutoff - gate.points);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl leading-none tabular-nums">{formatNumber(gate.points)}</span>
        <span>{say("ui.gate.points.cutoff", { cutoff: formatNumber(gate.cutoff) })}</span>
      </p>
      <Meter value={gate.points} max={gate.cutoff} label={say("ui.gate.points.title")} tone="ink" />
      <p className={short > 0 ? "text-bad" : "text-good"}>{short > 0 ? say("ui.gate.points.short", { short: formatNumber(short) }) : say("ui.gate.points.over")}</p>
      {gate.careCutoff === null ? null : <p className="text-muted">{say("ui.gate.points.care", { cutoff: formatNumber(gate.careCutoff) })}</p>}
      {gate.invitedMonth !== null ? (
        <p className="font-medium text-good">{say("ui.gate.points.invited", { month: monthEnding(gate.invitedMonth) })}</p>
      ) : gate.poolMonth === null ? (
        <p className="text-muted">{say("ui.gate.points.no-pool")}</p>
      ) : (
        <p>{say("ui.gate.points.pool", { month: monthEnding(gate.poolMonth), ends: monthEnding(gate.profileEndsMonth ?? gate.poolMonth), left: Math.max(0, (gate.profileEndsMonth ?? month) - month) })}</p>
      )}
      <p className="text-xs text-muted">{say("ui.gate.points.clock")}</p>
    </div>
  );
}

function Endorsement({ gate, month }: { gate: Extract<RouteGateView, { gate: "endorsement" }>; month: number }) {
  if (gate.refusedMonth === null) return <p className="text-sm text-muted">{say("ui.gate.endorsement.none")}</p>;
  const cooled = gate.cooledFromMonth !== null && month >= gate.cooledFromMonth;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="text-bad">{say("ui.gate.endorsement.refused", { month: monthEnding(gate.refusedMonth) })}</p>
      <p>{cooled ? say("ui.gate.endorsement.again-now") : say("ui.gate.endorsement.again", { month: playerMonth(gate.cooledFromMonth ?? 0) })}</p>
    </div>
  );
}

function Contract({ gate, currency }: { gate: Extract<RouteGateView, { gate: "contract" }>; currency: Currency }) {
  if (gate.employer === null) return <p className="text-sm text-muted">{say("ui.gate.contract.none")}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>{say("ui.gate.contract.who", { employer: employerWords(gate.employer) })}</p>
      {gate.role === null ? null : <p>{say("ui.gate.contract.role", { role: hasWords(`ui.gate.role.${gate.role}`) ? say(`ui.gate.role.${gate.role}`) : gate.role })}</p>}
      {gate.salary === null ? null : <p className="font-medium tabular-nums">{say("ui.gate.contract.salary", { salary: formatMoney(gate.salary, currency) })}</p>}
      <p className="text-muted">{say("ui.gate.contract.passport")}</p>
    </div>
  );
}

/** The partner or dependant gate: the bond it rests on and how the other side's application stands (R-PEOPLE-022, R-PEOPLE-026). */
function Bond({ gate }: { gate: Extract<RouteGateView, { gate: "partner" | "dependant" }> }) {
  const { people } = useView();
  const bond = gate.bond === null ? undefined : people.bonds.find((held) => held.id === gate.bond);
  if (bond === undefined) return <p className="text-sm text-muted">{say("ui.gate.bond.none")}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {bond.stage === "ended" ? (
        <p className="text-bad">{say("ui.gate.bond.ended")}</p>
      ) : (
        <p>{say("ui.gate.bond.with", { name: bondName(bond), stage: say(`ui.people.stage.${bond.stage}`).toLowerCase() })}</p>
      )}
      <p className="text-muted">{gate.lead === null ? say("ui.gate.lead.none") : say("ui.gate.lead.state", { state: say(`ui.route.state.${gate.lead}`).toLowerCase() })}</p>
    </div>
  );
}

/** The gate block of a route card. Null for the study gate and before the route is looked into. */
export function GatePanel({ route }: { route: RouteView }) {
  const { month } = useView();
  const gate = route.gate;
  if (gate === null || gate.gate === "road" || route.state === "heard" || route.state === "unknown") return null;
  const currency = countryCurrency(route);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3" data-gate={gate.gate}>
      <h4 className="text-sm font-semibold">{say(`ui.gate.${gate.gate}.title`)}</h4>
      {gate.gate === "sponsor" ? <Sponsor gate={gate} currency={currency} /> : null}
      {gate.gate === "points" ? <Points gate={gate} month={month} /> : null}
      {gate.gate === "endorsement" ? <Endorsement gate={gate} month={month} /> : null}
      {gate.gate === "contract" ? <Contract gate={gate} currency={currency} /> : null}
      {gate.gate === "partner" || gate.gate === "dependant" ? <Bond gate={gate} /> : null}
    </div>
  );
}
