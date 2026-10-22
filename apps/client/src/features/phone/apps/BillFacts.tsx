// What a bill of its own kind carries in Bills (world:phone-holds-what-phones-hold): the car on finance (car:view-shows-car-terms)
// with what is paid against the third and the half, the final payment, the interest a month, the notice or the court
// date, and handing it back once half is paid (car:car-handed-back-after-half); the sponsor's undertaking (undertaking:view-lists-undertaking)
// with the months left of the promise, the months charged and what is owed now. Small lines and chips on the bill's card.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";
import { useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { formatMoney } from "../../../shared/words/format";
import { blurbOf, say, sayCount } from "../../../shared/words/text";
import { GhostButton, MoneyChip, WordChip } from "../ui";

type Owed = PlayerView["obligations"][number];

export interface CarFigures {
  currency: Currency;
  price: number;
  paid: number;
  third: number;
  half: number;
  final: number;
  /** The interest a month the ladder fixed at opening. */
  interest: number;
  /** Two misses bring the lender's notice. */
  notice: boolean;
  /** Past the grace with a third paid: the lender has gone to court. */
  court: boolean;
  /** Months left before the car is taken, when it is in court. */
  courtMonthsLeft: number;
}

/** The car's figures from the view's `car` part (car:view-shows-car-terms), with the currency from its entry. Null for anything that is not a car. */
export function carFigures(owed: Owed, month: number): CarFigures | null {
  const entry = content.obligation[owed.entry];
  const car = owed.car;
  if (entry === undefined || car === null) return null;
  return {
    currency: entry.currency,
    price: car.price,
    paid: car.paid,
    third: car.third,
    half: car.half,
    final: car.final,
    interest: car.interest,
    notice: car.notice,
    court: car.courtMonth !== null,
    courtMonthsLeft: car.courtMonth === null ? 0 : Math.max(0, car.courtMonth - month),
  };
}

/** Where a figure stands along the price, as a share of the bar's width. */
function at(value: number, price: number): string {
  return `${String(price <= 0 ? 0 : Math.min(100, Math.floor((value * 100) / price)))}%`;
}

/** The car's paid bar with the third and the half marked, and the lines and the hand back under it. */
export function CarFacts({ owed }: { owed: Owed }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [sure, setSure] = useState(false);
  const figures = carFigures(owed, view.month);
  if (figures === null) return null;
  const { currency, price, paid, third, half, final, interest, notice, court, courtMonthsLeft } = figures;
  const label = say("ui.car.paid", { paid: formatMoney(paid, currency), price: formatMoney(price, currency) });
  const canHandBack = paid >= half;
  return (
    <div className="flex flex-col gap-2" data-car>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={price} aria-valuenow={paid} className="relative h-3 w-full rounded-[5px] bg-sheet-2">
        <div className="h-full rounded-[5px] bg-tint-money" style={{ width: at(paid, price), background: "var(--money-ink)" }} />
        <span aria-hidden="true" className="absolute -top-1 h-5 w-0.5 bg-text" style={{ left: at(third, price) }} />
        <span aria-hidden="true" className="absolute -top-1 h-5 w-0.5 bg-text" style={{ left: at(half, price) }} />
      </div>
      <div className="relative h-4 text-[12px] font-semibold text-text-2" aria-hidden="true">
        <span className="absolute -translate-x-1/2" style={{ left: at(third, price) }}>
          {say("ui.car.third-mark")}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: at(half, price) }}>
          {say("ui.car.half-mark")}
        </span>
      </div>
      <p className="num text-[14px] font-bold">{label}</p>
      <p className="text-[14px] leading-snug text-text-2">
        {paid >= half ? say("ui.car.past-half") : paid >= third ? say("ui.car.past-third", { half: formatMoney(half - paid, currency) }) : say("ui.car.under-third", { third: formatMoney(third - paid, currency) })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <MoneyChip out className="num">{say("ui.car.final", { amount: formatMoney(final, currency) })}</MoneyChip>
        <MoneyChip out className="num">{say("phone.bills.car.interest", { amount: formatMoney(interest, currency) })}</MoneyChip>
        {owed.monthsLeft === null ? null : <WordChip tone="plain">{sayCount("ui.obligation.months-left", owed.monthsLeft, { months: owed.monthsLeft })}</WordChip>}
      </div>
      {notice ? <p className="text-[14px] font-bold text-out">{say("ui.car.notice")}</p> : null}
      {court ? <p className="text-[14px] font-bold text-out">{sayCount("ui.car.court", courtMonthsLeft, { months: courtMonthsLeft })}</p> : null}
      {view.ended ? null : sure ? (
        <div className="flex gap-2">
          <GhostButton wide
            className="justify-center"
            disabled={busy}
            onClick={() => {
              setSure(false);
              void send({ type: "obligation/pay", obligation: owed.id, amount: 0 });
            }}
          >
            {say("ui.car.hand-back-yes")}
          </GhostButton>
          <GhostButton wide className="justify-center" onClick={() => setSure(false)}>
            {say("ui.car.keep")}
          </GhostButton>
        </div>
      ) : (
        <GhostButton wide className="justify-center" disabled={busy || !canHandBack} onClick={() => setSure(true)}>
          {say("ui.car.hand-back")}
        </GhostButton>
      )}
      {canHandBack ? null : <p className="text-[13px] text-text-2">{say("ui.car.hand-back-when", { amount: formatMoney(half, currency) })}</p>}
    </div>
  );
}

const ASSISTANCE = "var.canada-assistance";

/** The undertaking's promise: months left, months charged, what is owed now, and how a charge comes. */
export function UndertakingFacts({ owed }: { owed: Owed }) {
  const currency: Currency = content.obligation[owed.entry]?.currency ?? "CAD";
  const blurb = blurbOf(owed.entry);
  const assistance = content.var[ASSISTANCE]?.start ?? 0;
  const months = owed.monthsLeft ?? 0;
  return (
    <div className="flex flex-col gap-1.5 text-[14px] leading-snug" data-undertaking={owed.id}>
      {blurb === null ? null : <p className="text-text-2">{blurb}</p>}
      <div className="flex flex-wrap gap-1.5">
        <WordChip tone="plain">{sayCount("ui.undertaking.months-left", months, { months })}</WordChip>
        <WordChip tone="plain">{sayCount("ui.undertaking.charged", owed.charged, { months: owed.charged })}</WordChip>
      </div>
      <p className="num font-bold">{owed.outstanding > 0 ? say("ui.undertaking.owed", { amount: formatMoney(owed.outstanding, currency) }) : say("ui.undertaking.nothing-owed")}</p>
      <p className="text-text-2">{say("ui.undertaking.assistance", { amount: formatMoney(assistance, currency) })}</p>
    </div>
  );
}
