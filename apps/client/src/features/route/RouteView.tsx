// Ways out: each route the character has heard of, its checklist, schools,
// funds, visa and refusals. Percent, window and what is met all come from the
// view; the screen only lays them out.
import type { RouteView as Route } from "@japacity/sim";
import { Check, Circle, PlaneTakeoff } from "lucide-react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Meter } from "../../shared/ui/Meter";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { formatBp, formatMoney } from "../../shared/words/format";
import { hasWords, nameOf, say, words } from "../../shared/words/text";

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

function Schools({ route }: { route: Route }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  if (route.schools.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{say("ui.route.schools")}</h4>
      <ul className="flex flex-col gap-2">
        {route.schools.map((school) => {
          const chosen = route.school === school.id;
          const status =
            school.state === "pending"
              ? say("ui.route.school.pending", { month: school.readyMonth })
              : school.state === "offer"
                ? say("ui.route.school.offer")
                : say("ui.route.school.rejected");
          return (
            <li key={school.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3">
              <span className="flex-1 font-medium">{nameOf(school.id)}</span>
              <Tag tone={school.state === "offer" ? "good" : school.state === "rejected" ? "bad" : "plain"}>{status}</Tag>
              {school.discount > 0 ? <Tag>{say("ui.route.school.discount", { amount: formatMoney(school.discount, "GBP") })}</Tag> : null}
              {chosen ? <Tag tone="accent">{say("ui.route.school.chosen")}</Tag> : null}
              {school.state === "offer" && route.school === null ? (
                <Button small disabled={busy || ended} onClick={() => void send({ type: "route/pay-deposit", route: route.id, school: school.id })}>
                  {say("ui.route.pay-deposit")}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Funds({ route }: { route: Route }) {
  const { funds } = route;
  if (funds.required === 0 && funds.shown === 0 && route.support === null) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{say("ui.route.funds")}</h4>
      <Meter value={funds.shown} max={funds.required} label={say("ui.route.funds")} />
      <p className="text-sm">
        {say("ui.route.funds.line", { shown: formatMoney(funds.shown, "GBP"), required: formatMoney(funds.required, "GBP") })}
      </p>
      <p className="text-sm text-muted">{say("ui.route.funds.held", { months: funds.heldMonths })}</p>
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
      {route.visa === null ? null : <p>{say("ui.route.visa", { submitted: route.visa.submittedMonth, decision: route.visa.decisionMonth })}</p>}
      {route.refusals > 0 ? <p className="font-medium text-bad">{say("ui.route.refusals", { count: route.refusals })}</p> : null}
      {route.lastRefusal === null ? null : (
        <div>
          <p>{say("ui.route.last-refusal", { month: route.lastRefusal.month })}</p>
          <ul className="list-disc pl-5">
            {route.lastRefusal.reasons.map((reason) => (
              <li key={reason}>{hasWords(`ui.refusal.${reason}`) ? say(`ui.refusal.${reason}`) : reason}</li>
            ))}
          </ul>
        </div>
      )}
      {route.depositRefund === null ? null : (
        <p>{say("ui.route.refund", { amount: formatMoney(route.depositRefund.amount, "GBP"), month: route.depositRefund.readyMonth })}</p>
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
          {route.percent === null ? null : <span className="font-display text-3xl leading-none">{route.percent}%</span>}
        </div>
        {hasWords(`${route.id}.blurb`) ? <p className="text-sm text-muted">{blurb}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Tag tone={route.state === "granted" || route.state === "departed" ? "good" : "plain"}>{say(`ui.route.state.${route.state}`)}</Tag>
          <Tag tone={route.window === "closed" ? "bad" : route.window === "narrowing" ? "accent" : "plain"}>{say(`ui.route.window.${route.window}`)}</Tag>
        </div>
      </div>
      {route.state === "heard" ? <p className="text-sm">{say("ui.route.heard-only")}</p> : <Checklist route={route} />}
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
  const routes = view.routes.filter((route) => route.state !== "unknown");
  return (
    <Panel title={say("ui.route.title")}>
      {routes.length === 0 ? <Empty>{say("ui.route.none")}</Empty> : routes.map((route) => <RouteCard key={route.id} route={route} />)}
    </Panel>
  );
}
