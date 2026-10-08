// Ways out: each route the character has heard of, its checklist, schools,
// funds, visa and refusals. Percent, window and what is met all come from the
// view; the screen only lays them out.
import { content } from "@japacity/content";
import type { RouteView as Route } from "@japacity/sim";
import { Check, Circle, PlaneTakeoff } from "lucide-react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Meter } from "../../shared/ui/Meter";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { atBankRate, shortfall } from "../../shared/words/cost";
import { formatBand, formatBp, formatMoney, monthEnding } from "../../shared/words/format";
import { hasWords, lowerFirst, nameOf, say, sayCount, words } from "../../shared/words/text";
import { countryCurrency, GatePanel } from "./GatePanel";

const GRADE = "quality.edu-grade";

function Checklist({ route }: { route: Route }) {
  return (
    <ul className="flex flex-col gap-2" aria-label={say("ui.route.checklist")}>
      {route.checklist.map((item) => {
        const label = words(`${route.id}.item.${item.id}`);
        const partial = !item.met && item.have !== null && item.need !== null;
        return (
          <li key={item.id} data-met={item.met ? "true" : "false"} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              {item.met ? <Check size={18} className="mt-0.5 shrink-0 text-good" /> : <Circle size={18} className="mt-0.5 shrink-0 text-muted" />}
              <span className={item.met ? "text-muted line-through" : ""}>{label}</span>
            </div>
            {partial ? (
              <div className="pl-6">
                <Meter value={item.have ?? 0} max={item.need ?? 0} label={label} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type School = Route["schools"][number];

/** Every university on the route, with what it asks and costs, and the application where there is one. */
function Schools({ route }: { route: Route }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ids = content.route[route.id]?.schools ?? [];
  if (ids.length === 0 || route.state === "heard" || route.state === "unknown") return null;
  const applied = new Map<string, School>(route.schools.map((school) => [school.id, school]));
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{applied.size === 0 ? say("ui.route.schools.before") : say("ui.route.schools")}</h4>
      <ul className="flex flex-col gap-2">
        {ids.map((id) => {
          const entry = content.school[id];
          if (entry === undefined) return null;
          const school = applied.get(id);
          const chosen = route.school === id;
          const discount = school?.discount ?? 0;
          const status =
            school === undefined
              ? null
              : school.state === "pending"
                ? say("ui.route.school.pending", { month: monthEnding(school.readyMonth) })
                : school.state === "offer"
                  ? say("ui.route.school.offer")
                  : say("ui.route.school.rejected");
          const canPay = school?.state === "offer" && route.school === null;
          const deposit = shortfall(view, [{ currency: "GBP", amount: entry.deposit }]);
          const grade = hasWords(`${GRADE}.value.${String(entry.minGrade)}`) ? lowerFirst(say(`${GRADE}.value.${String(entry.minGrade)}`)) : String(entry.minGrade);
          return (
            <li key={id} data-school={id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-medium">{nameOf(id)}</span>
                {status === null || school === undefined ? null : (
                  <Tag tone={school.state === "offer" ? "good" : school.state === "rejected" ? "bad" : "plain"}>{status}</Tag>
                )}
                {discount > 0 ? <Tag>{say("ui.route.school.discount", { amount: formatMoney(discount, "GBP") })}</Tag> : null}
                {chosen ? <Tag tone="accent">{say("ui.route.school.chosen")}</Tag> : null}
              </div>
              <p className="text-sm">
                {discount > 0
                  ? say("ui.route.school.costs-discount", {
                      deposit: formatMoney(entry.deposit, "GBP"),
                      tuition: formatMoney(entry.tuition, "GBP"),
                      after: formatMoney(entry.tuition - discount, "GBP"),
                    })
                  : say("ui.route.school.costs", { deposit: formatMoney(entry.deposit, "GBP"), tuition: formatMoney(entry.tuition, "GBP") })}
              </p>
              {school === undefined ? (
                <p className="text-sm text-muted">{say("ui.route.school.asks", { band: formatBand(entry.minBand), grade })}</p>
              ) : null}
              {route.school === null ? (
                <p className="text-sm text-muted">{say("ui.route.school.naira", { naira: formatMoney(deposit.need, "NGN") })}</p>
              ) : null}
              {canPay && deposit.short > 0 ? (
                <p className="text-sm text-bad">
                  {say("ui.route.school.short", {
                    need: formatMoney(deposit.need, "NGN"),
                    have: formatMoney(deposit.have, "NGN"),
                    short: formatMoney(deposit.short, "NGN"),
                  })}
                </p>
              ) : null}
              {canPay ? (
                <div>
                  <Button small disabled={busy || view.ended} onClick={() => void send({ type: "route/pay-deposit", route: route.id, school: id })}>
                    {say("ui.route.pay-deposit")}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {route.school === null ? <p className="text-xs text-muted">{say("ui.route.foreign-fee")}</p> : null}
    </div>
  );
}

/** The funds now: the checklist's slow item carries them live, while the route's own record holds the last check. */
function fundsNow(route: Route): { shown: number; required: number } {
  const ids = (content.route[route.id]?.checklist ?? []).filter((item) => item.requirement.type === "route/funds").map((item) => item.id);
  const live = route.checklist.find((item) => ids.includes(item.id) && item.have !== null && item.need !== null);
  return live === undefined ? { shown: route.funds.shown, required: route.funds.required } : { shown: live.have ?? 0, required: live.need ?? 0 };
}

function Funds({ route }: { route: Route }) {
  const view = useView();
  const { shown, required } = fundsNow(route);
  const open = route.state === "known" || route.state === "applying";
  if (!open && shown === 0 && required === 0 && route.support === null) return null;
  const short = Math.max(0, required - shown);
  // Each gate shows its own line in its own currency (R-GATE-004).
  const currency = countryCurrency(route);
  return (
    <div className="flex flex-col gap-2" data-funds>
      <h4 className="text-sm font-semibold">{say("ui.route.funds")}</h4>
      {required === 0 ? (
        <p className="text-sm text-muted">{say("ui.route.funds.none-needed")}</p>
      ) : (
        <>
          <Meter value={shown} max={required} label={say("ui.route.funds")} />
          <p className="text-sm">{say("ui.route.funds.line", { shown: formatMoney(shown, currency), required: formatMoney(required, currency) })}</p>
          {short > 0 ? (
            <p className="text-sm text-bad">
              {say("ui.route.funds.short", { short: formatMoney(short, currency), naira: formatMoney(atBankRate(view, currency, short), "NGN") })}
            </p>
          ) : null}
          <p className="text-sm text-muted">{say("ui.route.funds.what")}</p>
          <p className="text-sm text-muted">{sayCount("ui.route.funds.held", route.funds.heldMonths, { months: route.funds.heldMonths })}</p>
        </>
      )}
      {route.support === null ? null : (
        <p className="text-sm">{say("ui.route.support", { amount: formatMoney(route.support.amount, route.support.currency) })}</p>
      )}
      {route.unexplainedBp > 0 ? <p className="text-sm text-bad">{say("ui.route.unexplained", { percent: formatBp(route.unexplainedBp) })}</p> : null}
    </div>
  );
}

function Record({ route }: { route: Route }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {route.depositPaid > 0 ? <p>{say("ui.route.deposit-paid", { amount: formatMoney(route.depositPaid, "GBP") })}</p> : null}
      {route.visa === null ? null : <p>{say("ui.route.visa", { submitted: monthEnding(route.visa.submittedMonth), decision: monthEnding(route.visa.decisionMonth) })}</p>}
      {route.refusals > 0 ? <p className="font-medium text-bad">{sayCount("ui.route.refusals", route.refusals, { count: route.refusals })}</p> : null}
      {route.lastRefusal === null ? null : (
        <div>
          <p>{say("ui.route.last-refusal", { month: monthEnding(route.lastRefusal.month) })}</p>
          <ul className="list-disc pl-5">
            {route.lastRefusal.reasons.map((reason) => (
              <li key={reason}>{hasWords(`ui.refusal.${reason}`) ? say(`ui.refusal.${reason}`) : reason}</li>
            ))}
          </ul>
        </div>
      )}
      {route.depositRefund === null ? null : (
        <p>{say("ui.route.refund", { amount: formatMoney(route.depositRefund.amount, "GBP"), month: monthEnding(route.depositRefund.readyMonth) })}</p>
      )}
    </div>
  );
}

function RouteCard({ route }: { route: Route }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const blurb = words(`${route.id}.blurb`);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">{nameOf(route.id)}</h3>
          {route.percent === null ? null : (
            <span className="font-display text-3xl leading-none">
              {route.percent}
              <span className="font-sans text-xl font-bold">%</span>
            </span>
          )}
        </div>
        {hasWords(`${route.id}.blurb`) ? <p className="text-sm text-muted">{blurb}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Tag tone={route.state === "granted" || route.state === "departed" ? "good" : "plain"}>{say(`ui.route.state.${route.state}`)}</Tag>
          <Tag tone={route.window === "closed" ? "bad" : route.window === "narrowing" ? "accent" : "plain"}>{say(`ui.route.window.${route.window}`)}</Tag>
        </div>
      </div>
      {route.state === "heard" ? <p className="text-sm">{say("ui.route.heard-only")}</p> : <Checklist route={route} />}
      <GatePanel route={route} />
      <Schools route={route} />
      <Funds route={route} />
      <Record route={route} />
      {route.state === "granted" ? (
        <Button variant="primary" disabled={busy} onClick={() => void send({ type: "route/depart", route: route.id })}>
          <PlaneTakeoff size={18} />
          {say("ui.route.depart")}
        </Button>
      ) : null}
    </Card>
  );
}

export function RouteView() {
  const view = useView();
  // A route nobody has told you about is not on screen: nobody picks a route at the start.
  // The road is never in the routes view (R-ROAD-001), whatever the engine sends.
  // Abroad, the route flown on is behind you: its checklist is history, not a plan.
  const abroad = view.place.where === "abroad";
  const routes = view.routes.filter(
    (route) => route.state !== "unknown" && !(abroad && route.state === "departed") && route.gate?.gate !== "road" && content.route[route.id]?.gate !== "road",
  );
  return (
    <Panel title={say("ui.route.title")}>
      {routes.length === 0 ? <Empty>{say("ui.route.none")}</Empty> : routes.map((route) => <RouteCard key={route.id} route={route} />)}
    </Panel>
  );
}
