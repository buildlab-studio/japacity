// Sending money home (R-ABROAD-006, 008): the amount, the channel, and for each
// channel what arrives in naira, worked out by the wallet kind's own quote so
// the choice is made with the engine's numbers in front of the player.
import { content } from "@japacity/content";
import type { Currency, ForeignCurrency } from "@japacity/sim";
import { Send } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "./Button";
import { Rejection } from "./Rejection";
import { Sheet } from "./Sheet";
import { REMIT_CHANNELS, remitQuote, type RemitChannel } from "../sim/remit";
import { CURRENCIES, formatBp, formatMoney, toMinor } from "../words/format";
import { say } from "../words/text";
import { localCurrency } from "../words/wayHome";

const inputClass = "min-h-11 rounded-lg border border-sheet-line bg-sheet-2 px-3";

function isForeign(currency: Currency): currency is ForeignCurrency {
  return currency !== "NGN";
}

/** Foreign currencies with money in the bank, the country's own first. */
function sendable(view: ReturnType<typeof useView>): ForeignCurrency[] {
  const local = localCurrency(view);
  const held = CURRENCIES.filter(isForeign).filter((currency) => view.pockets[currency].bank > 0);
  return [...held.filter((currency) => currency === local), ...held.filter((currency) => currency !== local)];
}

function parseAmount(typed: string): number | null {
  const value = Number(typed.replaceAll(",", ""));
  return Number.isFinite(value) && value > 0 ? toMinor(value) : null;
}

function RemitForm({ onDone }: { onDone: () => void }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const options = sendable(view);
  const [currency, setCurrency] = useState<ForeignCurrency | null>(options[0] ?? null);
  const [channel, setChannel] = useState<RemitChannel>("app");
  const [typed, setTyped] = useState("");
  const amountId = useId();
  const currencyId = useId();
  const amount = parseAmount(typed);

  if (currency === null) return <p className="text-text-2">{say("ui.remit.nothing")}</p>;
  const inBank = view.pockets[currency].bank;
  const quote = amount === null ? null : remitQuote(view.rates, content.tuning.remit, currency, amount);
  const tooMuch = amount !== null && amount > inBank;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (amount === null || currency === null) return;
    const reply = await send({ type: "wallet/remit", currency, amount, channel });
    if (reply?.ok === true) onDone();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Rejection />
      {options.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={currencyId} className="text-sm font-medium">
            {say("ui.wallet.currency")}
          </label>
          <select id={currencyId} value={currency} onChange={(event) => setCurrency(event.target.value as ForeignCurrency)} className={inputClass}>
            {options.map((option) => (
              <option key={option} value={option}>
                {say(`ui.currency.${option}`)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor={amountId} className="text-sm font-medium">
          {say("ui.remit.amount", { currency: say(`ui.currency.${currency}`).toLowerCase() })}
        </label>
        <input id={amountId} inputMode="decimal" value={typed} onChange={(event) => setTyped(event.target.value)} className={inputClass} />
        <p className={`text-sm ${tooMuch ? "text-bad" : "text-text-2"}`}>{say("ui.remit.in-bank", { amount: formatMoney(inBank, currency) })}</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{say("ui.remit.channel")}</legend>
        {REMIT_CHANNELS.map((option) => {
          const terms = quote?.[option];
          return (
            <label
              key={option}
              data-channel={option}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${channel === option ? "border-ink bg-sheet-muted" : "border-sheet-line"}`}
            >
              <input type="radio" name="channel" value={option} checked={channel === option} onChange={() => setChannel(option)} className="mt-1" />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{say(`ui.remit.channel.${option}`)}</span>
                <span className="text-sm text-text-2">{say(`ui.remit.how.${option}`, { loss: formatBp(content.tuning.remit.informalLossBp) })}</span>
                {terms === undefined ? null : (
                  <span className="text-sm tabular-nums" data-arrives>
                    {say("ui.remit.arrives", { naira: formatMoney(terms.naira, "NGN"), fee: formatMoney(terms.fee, currency) })}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={amount === null || tooMuch || busy}>
          {say("ui.remit.send")}
        </Button>
        <Button onClick={onDone}>{say("ui.wallet.cancel")}</Button>
      </div>
    </form>
  );
}

/** The button and its sheet. Shown only abroad: money is sent home from abroad. */
export function RemitButton() {
  const view = useView();
  const dismissRejection = useGame((state) => state.dismissRejection);
  const [open, setOpen] = useState(false);
  if (view.place.where !== "abroad") return null;
  const close = () => {
    setOpen(false);
    dismissRejection();
  };
  return (
    <>
      <Button small onClick={() => setOpen(true)} disabled={view.ended}>
        <Send size={16} />
        {say("ui.remit.title")}
      </Button>
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} title={say("ui.remit.title")} description={say("ui.remit.intro")}>
        <RemitForm onDone={close} />
      </Sheet>
    </>
  );
}
