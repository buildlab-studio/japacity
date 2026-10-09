// Open offers: requests, jobs, loans and men who can arrange things. The
// title, body, signs and choices are content's words; the terms fill the braces.
import { content } from "@japacity/content";
import { int, type Amount, type Currency, type Effect, type OfferView as Offer, type ReportLine, type Terms } from "@japacity/sim";
import { Eye, X } from "lucide-react";
import { useId, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { ReportLines } from "../../shared/ui/ReportLines";
import { isSaid, tidyLines } from "../../shared/words/lines";
import { formatMoney, toMajor, toMinor } from "../../shared/words/format";
import { byMonths, nameOf, say, sayCount, words } from "../../shared/words/text";
import { payAMonth } from "../../shared/words/pay";
import { offerParams } from "./terms";

/** A content amount as a figure, when the offer's terms or the entry say it outright. */
function figure(amount: Amount, terms: Terms): number | null {
  if (typeof amount === "number") return amount;
  if ("term" in amount) {
    const value = terms[amount.term];
    if (typeof value !== "number") return null;
    return amount.bp === undefined ? value : int.bp(value, amount.bp);
  }
  return null;
}

/** What a choice pays out, from content's effects, so a button never hides its price. */
function choiceCost(offer: Offer, choice: string): string | null {
  const effects: Effect[] = content.offer[offer.entry]?.choices.find((entry) => entry.id === choice)?.effects ?? [];
  const paid = new Map<Currency, number>();
  for (const effect of effects) {
    if (effect.type !== "money/take" && effect.type !== "money/pay-fee") continue;
    const amount = figure(effect.amount, offer.terms);
    if (amount !== null) paid.set(effect.currency, (paid.get(effect.currency) ?? 0) + amount);
  }
  if (paid.size === 0) return null;
  return [...paid].map(([currency, amount]) => formatMoney(amount, currency)).join(" + ");
}

/** The slots a choice holds, from its own `turn/lock` effects, said before it is taken (R-HEALTH-007). */
function choiceLock(offer: Offer, choice: string): string | null {
  const entry = content.offer[offer.entry];
  const effects: Effect[] = entry?.choices.find((candidate) => candidate.id === choice)?.effects ?? [];
  const lock = effects.find((effect) => effect.type === "turn/lock");
  if (lock === undefined) return null;
  const slots = sayCount("ui.offer.lock.slots", lock.slots, { count: lock.slots });
  const when = entry?.lockNext === undefined ? sayCount("ui.offer.lock.when", lock.months, { count: lock.months }) : say("ui.offer.lock.next");
  return say("ui.offer.lock", { slots, when });
}

/** A choice's label with what it costs and what it holds, so a button never hides either. */
function choiceLabel(offer: Offer, choice: Offer["choices"][number]): string {
  const label = words(`${offer.entry}.choice.${choice.id}`, offerParams(offer));
  const cost = choice.pick === null ? choiceCost(offer, choice.id) : null;
  const lock = choiceLock(offer, choice.id);
  const price = [cost, lock].filter((part): part is string => part !== null).join(", ");
  return price === "" ? label : say("ui.offer.choice-cost", { choice: label, amount: price });
}

/** The job and its pay, for an offer that carries a job in its terms. */
function JobFigures({ terms }: { terms: Terms }) {
  const job = terms.job;
  if (typeof job !== "string") return null;
  const pay = payAMonth(job);
  const amount = pay === null ? null : formatMoney(pay.amount, pay.currency);
  return <p className="font-semibold">{amount === null ? nameOf(job) : say("ui.offer.job", { job: nameOf(job), amount })}</p>;
}

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
        className="min-h-11 rounded-lg border border-sheet-line bg-sheet px-3 tabular-nums"
      />
      <p id={`${id}-bounds`} className="text-xs text-text-2">
        {say("ui.offer.bounds", { min: formatMoney(min, "NGN"), max: formatMoney(max, "NGN") })}
      </p>
    </div>
  );
}

function OfferCard({ offer, onChosen }: { offer: Offer; onChosen: (lines: ReportLine[]) => void }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const { ended, month } = useView();
  const picking = offer.choices.find((choice) => choice.pick !== null);
  const [amount, setAmount] = useState<number>(picking?.pick?.min ?? 0);
  const params = offerParams(offer);

  return (
    <li>
      <Card tone="attention" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{words(`${offer.entry}.title`, params)}</h3>
          <Tag>{say("ui.offer.expires", { when: byMonths(offer.expiresMonth, month) })}</Tag>
        </div>
        <JobFigures terms={offer.terms} />
        <p>{words(`${offer.entry}.body`, params)}</p>
        {offer.signs.length === 0 ? null : (
          <div className="flex flex-col gap-1 rounded-lg bg-sheet-muted p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Eye size={16} />
              {say("ui.offer.signs")}
            </p>
            <ul className="list-disc pl-5">
              {offer.signs.map((sign) => (
                <li key={sign}>{words(`${offer.entry}.sign.${sign}`, params)}</li>
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
                  ).then((reply) => {
                    if (reply?.ok === true) onChosen(reply.lines);
                  })
                }
              >
                {choiceLabel(offer, choice)}
              </Button>
          ))}
        </div>
      </Card>
    </li>
  );
}

/** What the last choice moved, so a choice is never silent. */
function Outcome({ lines, onClose }: { lines: ReportLine[]; onClose: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl border border-sheet-line bg-sheet-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{say("ui.offer.outcome")}</h3>
        <button type="button" aria-label={say("ui.dismiss")} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-sheet-muted" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {lines.length === 0 ? <p className="text-sm text-text-2">{say("ui.offer.outcome-none")}</p> : <ReportLines lines={[...tidyLines(lines)].sort((a, b) => Number(isSaid(b)) - Number(isSaid(a)))} />}
    </div>
  );
}

/** `only` keeps the offers a screen shows; the road shows its own and nothing from home (R-ROAD-010). */
export function OfferView({ only }: { only?: (offer: Offer) => boolean } = {}) {
  const view = useView();
  const offers = only === undefined ? view.offers : view.offers.filter(only);
  const [outcome, setOutcome] = useState<ReportLine[] | null>(null);
  return (
    <Panel title={say("ui.offer.title")}>
      {outcome === null ? null : <Outcome lines={outcome} onClose={() => setOutcome(null)} />}
      {offers.length === 0 ? (
        <Empty>{say("ui.offer.none")}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} onChosen={setOutcome} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
