// The car on finance (R-CAR-007): the price, what is paid so far against the
// third and the half, months left, the final payment, the rate, the misses in
// a row and whether a notice or a court date stands. Clearing the arrears and
// handing the car back once half is paid are the two moves (R-CAR-003, 004).
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { CarFront } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { formatBp, formatMoney } from "../../shared/words/format";
import { nameOf, say, sayCount } from "../../shared/words/text";

type Owed = PlayerView["obligations"][number];

const MONTHS_PER_YEAR = 12;
const WHOLE_BP = 10000;

function bp(amount: number, share: number): number {
  return Math.floor((amount * share) / WHOLE_BP);
}

export interface CarFigures {
  currency: Currency;
  price: number;
  paid: number;
  third: number;
  half: number;
  final: number;
  /** The yearly rate, in basis points, from the monthly interest fixed at opening. */
  yearlyBp: number;
  /** Two misses bring the lender's notice. */
  notice: boolean;
  /** Past the grace with a third paid: the lender has gone to court. */
  court: boolean;
  /** Misses left before the car is taken, when it is in court. */
  courtMonthsLeft: number;
}

/** The car's figures from its entry and the view. Null for anything that is not a car. */
export function carFigures(owed: Owed): CarFigures | null {
  const entry = content.obligation[owed.entry];
  const car = entry?.car;
  if (entry === undefined || car === undefined) return null;
  const price = car.price;
  const paid = price - owed.outstanding;
  const third = bp(price, car.courtThirdBp);
  const court = owed.missed > entry.grace && paid >= third;
  return {
    currency: entry.currency,
    price,
    paid,
    third,
    half: bp(price, car.handBackBp),
    final: bp(price, car.finalBp),
    yearlyBp: owed.principal === 0 ? 0 : Math.round((owed.amount * WHOLE_BP * MONTHS_PER_YEAR) / owed.principal),
    notice: owed.missed === entry.grace && entry.grace > 0,
    court,
    courtMonthsLeft: court ? Math.max(0, entry.grace + 1 + car.courtMonths - owed.missed) : 0,
  };
}

function PaidBar({ figures }: { figures: CarFigures }) {
  const { price, paid, third, half, currency } = figures;
  const at = (value: number) => `${String(Math.min(100, (value / price) * 100))}%`;
  const label = say("ui.car.paid", { paid: formatMoney(paid, currency), price: formatMoney(price, currency) });
  return (
    <div className="flex flex-col gap-1">
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={price} aria-valuenow={paid} className="relative h-4 w-full rounded-full bg-sunk">
        <div className="h-full rounded-full bg-accent" style={{ width: at(paid) }} />
        <span aria-hidden="true" className="absolute -top-1 h-6 w-0.5 bg-ink" style={{ left: at(third) }} />
        <span aria-hidden="true" className="absolute -top-1 h-6 w-0.5 bg-good" style={{ left: at(half) }} />
      </div>
      <div className="relative h-5 text-xs text-muted" aria-hidden="true">
        <span className="absolute -translate-x-1/2" style={{ left: at(third) }}>
          {say("ui.car.third-mark")}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: at(half) }}>
          {say("ui.car.half-mark")}
        </span>
      </div>
      <p className="text-sm font-medium tabular-nums">{label}</p>
    </div>
  );
}

export function CarCard({ owed }: { owed: Owed }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [sure, setSure] = useState(false);
  const figures = carFigures(owed);
  if (figures === null) return null;
  const { currency, paid, third, half, final, yearlyBp, notice, court, courtMonthsLeft } = figures;
  const canHandBack = paid >= half;
  return (
    <li>
      <Card tone={notice || court ? "attention" : "plain"} className="flex flex-col gap-3" data-car>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <CarFront size={18} />
            {nameOf(owed.entry)}
          </h3>
          <Tag tone={owed.state === "active" ? "plain" : "bad"}>{say(`ui.obligation.state.${owed.state}`)}</Tag>
        </div>
        <PaidBar figures={figures} />
        <ul className="flex flex-col gap-1 text-sm">
          <li>{paid >= half ? say("ui.car.past-half") : paid >= third ? say("ui.car.past-third", { half: formatMoney(half - paid, currency) }) : say("ui.car.under-third", { third: formatMoney(third - paid, currency) })}</li>
          <li className="tabular-nums">{say("ui.obligation.due", { amount: formatMoney(owed.due, currency) })}</li>
          {owed.monthsLeft === null ? null : <li>{sayCount("ui.obligation.months-left", owed.monthsLeft, { months: owed.monthsLeft })}</li>}
          <li className="tabular-nums">{say("ui.car.final", { amount: formatMoney(final, currency) })}</li>
          <li>{say("ui.car.rate", { rate: formatBp(yearlyBp) })}</li>
        </ul>
        {owed.missed > 0 ? <p className="text-sm text-bad">{sayCount("ui.obligation.missed", owed.missed, { count: owed.missed })}</p> : null}
        {notice ? <p className="text-sm font-medium text-bad">{say("ui.car.notice")}</p> : null}
        {court ? <p className="text-sm font-medium text-bad">{sayCount("ui.car.court", courtMonthsLeft, { months: courtMonthsLeft })}</p> : null}
        {view.ended ? null : (
          <div className="flex flex-wrap gap-2">
            {owed.missed > 0 && owed.due > 0 ? (
              <Button small variant="primary" disabled={busy} onClick={() => void send({ type: "obligation/pay", obligation: owed.id, amount: owed.due })}>
                {say("ui.car.clear", { amount: formatMoney(owed.due, currency) })}
              </Button>
            ) : null}
            {sure ? (
              <>
                <Button
                  small
                  disabled={busy}
                  onClick={() => {
                    setSure(false);
                    void send({ type: "obligation/pay", obligation: owed.id, amount: 0 });
                  }}
                >
                  {say("ui.car.hand-back-yes")}
                </Button>
                <Button small variant="quiet" onClick={() => setSure(false)}>
                  {say("ui.car.keep")}
                </Button>
              </>
            ) : (
              <Button small disabled={busy || !canHandBack} onClick={() => setSure(true)}>
                {say("ui.car.hand-back")}
              </Button>
            )}
          </div>
        )}
        {canHandBack ? null : <p className="text-xs text-muted">{say("ui.car.hand-back-when", { amount: formatMoney(half, currency) })}</p>}
      </Card>
    </li>
  );
}
