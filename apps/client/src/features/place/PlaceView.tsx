// Where the character is and the way home: the country, the months here, the
// record of every return, and the fare with the shape a return would take
// today (R-PLACE-009, R-RETURN-001). The shape is shown only as a forecast; the
// record holds only returns that have happened.
import { content } from "@japacity/content";
import { House, MapPin } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Panel } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { formatMoney } from "../../shared/words/format";
import { hasWords, nameOf, say, sayCount } from "../../shared/words/text";
import { wayHome } from "../../shared/words/wayHome";

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function Where() {
  const view = useView();
  const { where, country, monthsHere, heldAbroad } = view.place;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <MapPin size={20} className="mt-0.5 shrink-0 text-muted" />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">
            {where === "abroad" && country !== null
              ? hasWords(`ui.place.in.${country}`)
                ? say(`ui.place.in.${country}`)
                : say("ui.place.in", { country: nameOf(country) })
              : say(`ui.place.now.${where}`)}
          </p>
          <p className="text-sm text-muted">{sayCount("ui.place.months-here", monthsHere, { months: monthsHere })}</p>
        </div>
      </div>
      {heldAbroad === null ? null : <p className="text-sm">{say("ui.place.token", { status: nameOf(heldAbroad) })}</p>}
    </Card>
  );
}

function Returns() {
  const { returns } = useView().place;
  if (returns.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-semibold">{say("ui.place.returns")}</h3>
      <ol className="flex flex-col gap-1 text-sm" aria-label={say("ui.place.returns")}>
        {returns.map((back) => (
          <li key={`${String(back.month)}-${back.country ?? "road"}`}>
            {say("ui.place.return-item", { month: back.month + 1, country: back.country === null ? say("ui.place.road-name") : nameOf(back.country), shape: say(`ui.place.shape.${back.shape}`) })}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** The fare, where it comes from, the shape it would take today, and the button. */
function WayHomeCard() {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [sure, setSure] = useState(false);
  const home = wayHome(view);
  if (home === null) return null;
  const { fare, paidFrom, naira, shape, standing } = home;
  const assisted = shape === "assisted";
  const country = view.place.country;
  const peak = country === null ? undefined : content.country[country];

  return (
    <Card tone={assisted ? "attention" : "plain"} className="flex flex-col gap-3" data-way-home>
      <div className="flex items-start gap-3">
        <House size={20} className="mt-0.5 shrink-0 text-muted" />
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{say("ui.place.way-home")}</h3>
          <p className="tabular-nums">{say("ui.place.fare", { fare: formatMoney(fare.amount, fare.currency) })}</p>
          {peak === undefined ? null : (
            <p className="text-sm text-muted">{say("ui.place.fare-december", { fare: formatMoney(Math.floor((fare.amount * peak.decemberFactorBp) / 10000), fare.currency) })}</p>
          )}
          {paidFrom === "naira" ? <p className="text-sm">{say("ui.place.fare-naira", { naira: formatMoney(naira, "NGN") })}</p> : null}
          {paidFrom === null && !assisted ? <p className="text-sm text-bad">{say("ui.place.fare-short", { fare: formatMoney(fare.amount, fare.currency), naira: formatMoney(naira, "NGN") })}</p> : null}
        </div>
      </div>
      {shape === null ? null : (
        <div className="flex flex-col gap-1 rounded-lg bg-sunk p-3 text-sm">
          <p className="font-medium">{say(`ui.place.shape-now.${shape}`)}</p>
          <p>{say("ui.place.standing", { change: signed(standing) })}</p>
          <p className="text-muted">{say("ui.place.what-closes")}</p>
        </div>
      )}
      <Rejection />
      {shape === null || view.ended ? null : sure ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p>{say(assisted ? "ui.place.assisted-sure" : "ui.place.go-sure")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              small
              variant="primary"
              disabled={busy}
              onClick={() => {
                setSure(false);
                void send({ type: "return/home" });
              }}
            >
              {say("ui.place.go-yes")}
            </Button>
            <Button small onClick={() => setSure(false)}>
              {say("ui.place.go-no")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant={assisted ? "primary" : "secondary"} disabled={busy} onClick={() => setSure(true)}>
            {say(assisted ? "ui.place.go-assisted" : "ui.place.go")}
          </Button>
        </div>
      )}
      {assisted ? <p className="text-sm text-muted">{say("ui.place.assisted-why")}</p> : null}
      {shape === null ? <p className="text-sm text-muted">{say("ui.place.no-way")}</p> : null}
      <p className="text-xs text-muted">{say("ui.place.fare-note")}</p>
    </Card>
  );
}

/** At home the panel shows only when there is something to say: a return on record or a status kept abroad. */
export function PlaceView() {
  const view = useView();
  const { where, returns, heldAbroad } = view.place;
  if (where === "home" && returns.length === 0 && heldAbroad === null) return null;
  return (
    <Panel title={say("ui.place.title")}>
      <Where />
      <WayHomeCard />
      <Returns />
    </Panel>
  );
}
