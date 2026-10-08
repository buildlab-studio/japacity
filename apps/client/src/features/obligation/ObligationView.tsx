// What is owed this month and what is still owed on loans. Paying early is
// offered for loans and held funds, the two kinds content says take a payment;
// the engine still decides whether it is allowed.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { useId, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { formatMoney, toMinor } from "../../shared/words/format";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { CarCard } from "./CarCard";
import { UndertakingCard } from "./UndertakingCard";

type Owed = PlayerView["obligations"][number];

function PayLoan({ owed, currency }: { owed: Owed; currency: Currency }) {
  const id = useId();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [typed, setTyped] = useState("");
  const major = Number(typed.replaceAll(",", ""));
  const amount = Number.isFinite(major) && major > 0 ? toMinor(major) : null;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (amount !== null) void send({ type: "obligation/pay", obligation: owed.id, amount });
      }}
    >
      <label htmlFor={id} className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">{say("ui.wallet.amount")}</span>
        <input id={id} inputMode="decimal" value={typed} onChange={(event) => setTyped(event.target.value)} className="min-h-11 rounded-lg border border-line bg-paper px-3" />
      </label>
      <Button type="submit" small disabled={amount === null || busy}>
        {say("ui.obligation.pay")} {amount === null ? null : formatMoney(amount, currency)}
      </Button>
    </form>
  );
}

function OwedCard({ owed }: { owed: Owed }) {
  const entry = content.obligation[owed.entry];
  const currency: Currency = entry?.currency ?? "NGN";
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  return (
    <li>
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold">{nameOf(owed.entry)}</h3>
          <Tag tone={owed.state === "active" ? "plain" : "bad"}>{say(`ui.obligation.state.${owed.state}`)}</Tag>
        </div>
        <p className="font-medium tabular-nums">{say("ui.obligation.due", { amount: formatMoney(owed.due, currency) })}</p>
        {owed.outstanding > 0 ? <p className="text-sm tabular-nums">{say("ui.obligation.outstanding", { amount: formatMoney(owed.outstanding, currency) })}</p> : null}
        {owed.monthsLeft === null ? null : <p className="text-sm text-muted">{sayCount("ui.obligation.months-left", owed.monthsLeft, { months: owed.monthsLeft })}</p>}
        {owed.missed > 0 ? <p className="text-sm text-bad">{sayCount("ui.obligation.missed", owed.missed, { count: owed.missed })}</p> : null}
        {ended ? null : entry?.type === "loan" && owed.outstanding > 0 ? (
          <PayLoan owed={owed} currency={currency} />
        ) : entry?.type === "held-funds" && owed.outstanding > 0 ? (
          <div>
            <Button small disabled={busy} onClick={() => void send({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding })}>
              {say("ui.obligation.return")}
            </Button>
          </div>
        ) : null}
      </Card>
    </li>
  );
}

export function ObligationView() {
  const { obligations } = useView();
  return (
    <Panel title={say("ui.obligation.title")}>
      {obligations.length === 0 ? (
        <Empty>{say("ui.obligation.none")}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {obligations.map((owed) =>
            content.obligation[owed.entry]?.type === "car" ? (
              <CarCard key={owed.id} owed={owed} />
            ) : content.obligation[owed.entry]?.type === "undertaking" ? (
              <UndertakingCard key={owed.id} owed={owed} />
            ) : (
              <OwedCard key={owed.id} owed={owed} />
            ),
          )}
        </ul>
      )}
    </Panel>
  );
}
