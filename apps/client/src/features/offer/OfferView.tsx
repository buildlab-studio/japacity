// Open offers: requests, jobs, loans and men who can arrange things. The
// title, body, signs and choices are content's words; the terms fill the braces.
import type { OfferView as Offer } from "@japacity/sim";
import { Eye } from "lucide-react";
import { useId, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { formatMoney, toMajor, toMinor } from "../../shared/words/format";
import { say, words } from "../../shared/words/text";

/** Whole naira steps for the picker; the engine takes kobo. */
const STEP_MAJOR = 1000;

function AmountPicker({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (value: number) => void }) {
  const id = useId();
  const minMajor = Math.ceil(toMajor(min));
  const maxMajor = Math.floor(toMajor(max));
  const set = (major: number) => onChange(toMinor(Math.min(maxMajor, Math.max(minMajor, Math.round(major)))));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {say("ui.offer.amount")}: <span className="font-semibold">{formatMoney(value, "NGN")}</span>
      </label>
      <input
        type="range"
        min={minMajor}
        max={maxMajor}
        step={STEP_MAJOR}
        value={toMajor(value)}
        onChange={(event) => set(Number(event.target.value))}
        aria-describedby={`${id}-bounds`}
        className="accent-(--accent)"
      />
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={minMajor}
        max={maxMajor}
        value={toMajor(value)}
        onChange={(event) => set(Number(event.target.value))}
        className="min-h-11 rounded-lg border border-line bg-paper px-3 tabular-nums"
      />
      <p id={`${id}-bounds`} className="text-xs text-muted">
        {say("ui.offer.bounds", { min: formatMoney(min, "NGN"), max: formatMoney(max, "NGN") })}
      </p>
    </div>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  const picking = offer.choices.find((choice) => choice.pick !== null);
  const [amount, setAmount] = useState<number>(picking?.pick?.min ?? 0);

  return (
    <li>
      <Card tone="attention" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{words(`${offer.entry}.title`, offer.terms)}</h3>
          <Tag>{say("ui.offer.expires", { month: offer.expiresMonth })}</Tag>
        </div>
        <p>{words(`${offer.entry}.body`, offer.terms)}</p>
        {offer.signs.length === 0 ? null : (
          <div className="flex flex-col gap-1 rounded-lg bg-sunk p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Eye size={16} />
              {say("ui.offer.signs")}
            </p>
            <ul className="list-disc pl-5">
              {offer.signs.map((sign) => (
                <li key={sign}>{words(`${offer.entry}.sign.${sign}`, offer.terms)}</li>
              ))}
            </ul>
          </div>
        )}
        {picking === undefined || picking.pick === null ? null : (
          <AmountPicker min={picking.pick.min} max={picking.pick.max} value={amount} onChange={setAmount} />
        )}
        <div className="flex flex-wrap gap-2">
          {offer.choices.map((choice, index) => (
            <Button
              key={choice.id}
              variant={index === 0 ? "primary" : "secondary"}
              disabled={!choice.allowed || busy || ended}
              onClick={() =>
                void send(
                  choice.pick === null
                    ? { type: "offer/choose", offer: offer.id, choice: choice.id }
                    : { type: "offer/choose", offer: offer.id, choice: choice.id, amount },
                )
              }
            >
              {words(`${offer.entry}.choice.${choice.id}`, offer.terms)}
            </Button>
          ))}
        </div>
      </Card>
    </li>
  );
}

export function OfferView() {
  const { offers } = useView();
  return (
    <Panel title={say("ui.offer.title")}>
      {offers.length === 0 ? (
        <Empty>{say("ui.offer.none")}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
