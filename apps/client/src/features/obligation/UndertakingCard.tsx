// The sponsor's undertaking in the obligation list (R-UNDERTAKING-012): the
// months left of the promise, the months of assistance charged so far, what is
// owed now, and the line that says how a charge comes. It outlives the
// relationship (R-UNDERTAKING-009), so nothing here names the bond's stage.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, nameOf, say, sayCount } from "../../shared/words/text";

type Owed = PlayerView["obligations"][number];

const ASSISTANCE = "var.ca-assistance";

export function UndertakingCard({ owed }: { owed: Owed }) {
  const entry = content.obligation[owed.entry];
  const currency: Currency = entry?.currency ?? "CAD";
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  const blurb = blurbOf(owed.entry);
  const assistance = content.var[ASSISTANCE]?.start ?? 0;
  const months = owed.monthsLeft ?? 0;
  return (
    <li>
      <Card className="flex flex-col gap-2" data-undertaking={owed.id}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold">{nameOf(owed.entry)}</h3>
          <Tag tone={owed.state === "active" ? "plain" : "bad"}>{say(`ui.obligation.state.${owed.state}`)}</Tag>
        </div>
        {blurb === null ? null : <p className="text-sm text-muted">{blurb}</p>}
        <p className="text-sm">{sayCount("ui.undertaking.months-left", months, { months })}</p>
        <p className="text-sm">{sayCount("ui.undertaking.charged", owed.charged, { months: owed.charged })}</p>
        <p className="font-medium tabular-nums">{owed.outstanding > 0 ? say("ui.undertaking.owed", { amount: formatMoney(owed.outstanding, currency) }) : say("ui.undertaking.nothing-owed")}</p>
        {owed.due > 0 ? <p className="text-sm tabular-nums">{say("ui.obligation.due", { amount: formatMoney(owed.due, currency) })}</p> : null}
        {owed.missed > 0 ? <p className="text-sm text-bad">{sayCount("ui.obligation.missed", owed.missed, { count: owed.missed })}</p> : null}
        <p className="text-sm text-muted">{say("ui.undertaking.assistance", { amount: formatMoney(assistance, currency) })}</p>
        {ended || owed.outstanding === 0 ? null : (
          <div>
            <Button small disabled={busy} onClick={() => void send({ type: "obligation/pay", obligation: owed.id, amount: owed.outstanding })}>
              {say("ui.undertaking.pay")} {formatMoney(owed.outstanding, currency)}
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}
