// Money: what is in each pocket, the two rates, the bank allowance, and
// conversions on the way. Changing and moving money go through small forms;
// the engine decides what is allowed and the rejection's words say why not.
import type { Currency, PlayerView, Pocket } from "@japacity/sim";
import { ArrowLeftRight, MoveVertical } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Panel } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { Sheet } from "../../shared/ui/Sheet";
import { CURRENCIES, formatMoney, formatOne, formatRate, HOME_CURRENCIES, toMinor } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { RemitButton } from "../../shared/ui/RemitSheet";
import { localCurrency } from "../../shared/words/wayHome";

/** The currencies this life deals in: the home three, and the country's own once abroad. */
function dealtIn(view: Pick<PlayerView, "place">): Currency[] {
  const local = localCurrency(view);
  return local === null || HOME_CURRENCIES.includes(local) ? [...HOME_CURRENCIES] : [...HOME_CURRENCIES, local];
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const inputClass = "min-h-11 rounded-lg border border-line bg-surface px-3";

function CurrencySelect({ id, value, onChange, exclude }: { id: string; value: Currency; onChange: (value: Currency) => void; exclude?: Currency }) {
  const view = useView();
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as Currency)} className={inputClass}>
      {dealtIn(view).filter((currency) => currency !== exclude).map((currency) => (
        <option key={currency} value={currency}>
          {say(`ui.currency.${currency}`)}
        </option>
      ))}
    </select>
  );
}

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 ${value === option.value ? "border-ink bg-sunk" : "border-line"}`}
        >
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** Whole or decimal major units typed by the player, or null when it is not a number above zero. */
function parseAmount(typed: string): number | null {
  const value = Number(typed.replaceAll(",", ""));
  return Number.isFinite(value) && value > 0 ? toMinor(value) : null;
}

function ConvertForm({ onDone }: { onDone: () => void }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [from, setFrom] = useState<Currency>("NGN");
  const [to, setTo] = useState<Currency>("GBP");
  const [via, setVia] = useState<"bank" | "aboki">("bank");
  const [typed, setTyped] = useState("");
  const amount = parseAmount(typed);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (amount === null) return;
    const reply = await send({ type: "wallet/convert", from, to, amount, via });
    if (reply?.ok === true) onDone();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Rejection />
      <div className="grid grid-cols-2 gap-3">
        <Field label={say("ui.wallet.from")}>
          {(id) => (
            <CurrencySelect
              id={id}
              value={from}
              onChange={(value) => {
                setFrom(value);
                if (value === to) setTo(value === "NGN" ? "GBP" : "NGN");
              }}
            />
          )}
        </Field>
        <Field label={say("ui.wallet.to")}>{(id) => <CurrencySelect id={id} value={to} onChange={setTo} exclude={from} />}</Field>
      </div>
      <Field label={say("ui.wallet.amount")}>
        {(id) => <input id={id} inputMode="decimal" value={typed} onChange={(event) => setTyped(event.target.value)} className={inputClass} />}
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{say("ui.wallet.via")}</legend>
        <Choice
          name="via"
          value={via}
          onChange={setVia}
          options={[
            { value: "bank", label: say("ui.wallet.via.bank") },
            { value: "aboki", label: say("ui.wallet.via.aboki") },
          ]}
        />
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={amount === null || busy}>
          {say("ui.wallet.send")}
        </Button>
        <Button onClick={onDone}>{say("ui.wallet.cancel")}</Button>
      </div>
    </form>
  );
}

function MoveForm({ onDone }: { onDone: () => void }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [to, setTo] = useState<Pocket>("bank");
  const [typed, setTyped] = useState("");
  const amount = parseAmount(typed);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (amount === null) return;
    const reply = await send({ type: "wallet/move", currency, amount, to });
    if (reply?.ok === true) onDone();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
      <Rejection />
      <Field label={say("ui.wallet.currency")}>{(id) => <CurrencySelect id={id} value={currency} onChange={setCurrency} />}</Field>
      <Field label={say("ui.wallet.amount")}>
        {(id) => <input id={id} inputMode="decimal" value={typed} onChange={(event) => setTyped(event.target.value)} className={inputClass} />}
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">{say("ui.wallet.to")}</legend>
        <Choice
          name="to"
          value={to}
          onChange={setTo}
          options={[
            { value: "bank", label: say("ui.wallet.to-bank") },
            { value: "cash", label: say("ui.wallet.to-cash") },
          ]}
        />
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={amount === null || busy}>
          {say("ui.wallet.send")}
        </Button>
        <Button onClick={onDone}>{say("ui.wallet.cancel")}</Button>
      </div>
    </form>
  );
}

export function WalletView() {
  const view = useView();
  const dismissRejection = useGame((state) => state.dismissRejection);
  const [open, setOpen] = useState<"convert" | "move" | null>(null);
  const close = () => {
    setOpen(null);
    dismissRejection();
  };
  // Show naira always, and a foreign currency once there is something in it.
  const held = CURRENCIES.filter((currency) => {
    const pocket = view.pockets[currency];
    return currency === "NGN" || pocket.bank + pocket.cash + pocket.locked > 0;
  });

  return (
    <Panel title={say("ui.wallet.title")}>
      <Card className="flex flex-col gap-3">
        <table className="w-full text-left">
          <thead className="text-sm text-muted">
            <tr>
              <th scope="col" className="font-normal" />
              <th scope="col" className="font-normal">{say("ui.wallet.bank")}</th>
              <th scope="col" className="font-normal">{say("ui.wallet.cash")}</th>
              <th scope="col" className="font-normal">{say("ui.wallet.locked")}</th>
            </tr>
          </thead>
          <tbody>
            {held.map((currency) => {
              const pocket = view.pockets[currency];
              return (
                <tr key={currency} className="border-t border-line">
                  <th scope="row" className="py-2 pr-2 text-sm font-medium">{say(`ui.currency.${currency}`)}</th>
                  <td className="py-2 pr-2 font-semibold tabular-nums">{formatMoney(pocket.bank, currency)}</td>
                  <td className="py-2 pr-2 tabular-nums">{formatMoney(pocket.cash, currency)}</td>
                  <td className="py-2 tabular-nums text-muted">{formatMoney(pocket.locked, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <Button small onClick={() => setOpen("convert")} disabled={view.ended}>
            <ArrowLeftRight size={16} />
            {say("ui.wallet.convert")}
          </Button>
          <Button small onClick={() => setOpen("move")} disabled={view.ended}>
            <MoveVertical size={16} />
            {say("ui.wallet.move")}
          </Button>
          <RemitButton />
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 className="font-semibold">{say("ui.wallet.rates")}</h3>
        <table className="w-full text-left text-sm" data-rates>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="font-normal" />
              <th scope="col" className="font-normal">{say("ui.wallet.rate.official")}</th>
              <th scope="col" className="font-normal">{say("ui.wallet.rate.street")}</th>
            </tr>
          </thead>
          <tbody>
            {dealtIn(view).filter((currency) => currency !== "NGN").map((currency) => (
              <tr key={currency}>
                <th scope="row" className="py-1 pr-2 font-medium">{formatOne(currency)}</th>
                <td className="py-1 pr-2 tabular-nums">{formatMoney(view.rates[currency].official, "NGN")}</td>
                <td className="py-1 tabular-nums">{formatRate(view.rates[currency].street, "NGN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-muted">{say("ui.wallet.allowance", { amount: formatMoney(view.bankAllowanceLeft, "USD") })}</p>
      </Card>

      {view.queued.length === 0 ? null : (
        <Card className="flex flex-col gap-2">
          <h3 className="font-semibold">{say("ui.wallet.queued")}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {view.queued.map((item) => (
              <li key={item.id}>
                {say("ui.wallet.queued.item", {
                  paid: formatMoney(item.paid, item.from),
                  to: say(`ui.currency.${item.to}`),
                  month: item.readyMonth,
                })}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet open={open === "convert"} onOpenChange={(next) => (next ? setOpen("convert") : close())} title={say("ui.wallet.convert")}>
        <ConvertForm onDone={close} />
      </Sheet>
      <Sheet open={open === "move"} onOpenChange={(next) => (next ? setOpen("move") : close())} title={say("ui.wallet.move")}>
        <MoveForm onDone={close} />
      </Sheet>
    </Panel>
  );
}
