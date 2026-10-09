// Bank (docs/rules/world.md R-WORLD-018, 019): the balance as a counter, what is saved toward the
// move, the last few money lines, and the two acts the wallet offers, Change money and Move money,
// each chosen with a few chips and confirmed on its own card. Abroad the country's money stands
// first, the naira and the dollars after it each with Change money, and a month whose dues pass the
// country's money held leads with the gap and the way. Once flown, the
// move's target is gone.
import { content } from "@japacity/content";
import type { Currency, PlayerView, Pocket, ReportLine, RouteView } from "@japacity/sim";
import { ArrowLeftRight, MoveVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { duesGap, heldElsewhere } from "../../../shared/words/dues";
import { CURRENCIES, formatMoney, HOME_CURRENCIES } from "../../../shared/words/format";
import { afterPrologue, movesMoney, tidyLines } from "../../../shared/words/lines";
import { lowerFirst, moneyParam, say, words } from "../../../shared/words/text";
import { localCurrency } from "../../../shared/words/wayHome";
import { Counter } from "../../../shared/world/Band";
import { Chips, Head, useAsk } from "../act";
import { phoneWords } from "../phone.words";
import { abroadWords, changeFirst, currencyList } from "./abroad";

/** The currencies this life deals in: the home three, and the country's own once abroad. */
function dealtIn(view: Pick<PlayerView, "place">): Currency[] {
  const local = localCurrency(view);
  return local === null || HOME_CURRENCIES.includes(local) ? [...HOME_CURRENCIES] : [...HOME_CURRENCIES, local];
}

/** The route the savings count toward: the japacity figure's route, or the first with a figure to show. */
function savingsRoute(view: PlayerView): RouteView | null {
  const lead = view.routes.find((route) => route.id === view.japacity.route);
  if (lead !== undefined) return lead;
  return view.routes.find((route) => route.funds.required > 0) ?? null;
}

/** The funds now: the checklist's funds item carries them live, the route's record the last check. */
export function savingsOf(view: PlayerView): { shown: number; required: number; currency: Currency } | null {
  const route = savingsRoute(view);
  if (route === null) return null;
  const ids = (content.route[route.id]?.checklist ?? []).filter((item) => item.requirement.type === "route/funds").map((item) => item.id);
  const live = route.checklist.find((item) => ids.includes(item.id) && item.have !== null && item.need !== null);
  const shown = live?.have ?? route.funds.shown;
  const required = live?.need ?? route.funds.required;
  if (required === 0) return null;
  const country = content.route[route.id]?.country ?? null;
  const currency = (country === null ? undefined : content.country[country]?.currency) ?? "GBP";
  return { shown, required, currency };
}

/**
 * The money that moved lately, newest last: the month just ended (its mid-month moves and its end)
 * and this month's so far, each move once, as the results count them (R-WORLD-019: a payment split
 * across pockets is one line, a bill's "paid this month" is the same money, a fare paid on the way
 * is a move too).
 */
export function latelyLines(view: Pick<PlayerView, "report">, lastMonth: readonly ReportLine[], thisMonth: readonly ReportLine[]): ReportLine[] {
  const ended = view.report === null ? [] : [...lastMonth, ...view.report.lines];
  return [...moved(ended), ...moved(thisMonth)];
}

/** A deposit flagged carries its amount as a warning; no money moves with it. */
const FLAGGED = "line.wallet.flagged";

/** The lines that tell money moving, tidied as the month's results tidy them (features/turn/month.results.ts, `moneyLines`). */
function moved(lines: readonly ReportLine[]): ReportLine[] {
  return tidyLines(afterPrologue(lines)).filter((line) => line.tone !== "plain" && line.key !== FLAGGED && movesMoney(line) && (moneyParam("amount", line.params, line.key)?.amount ?? 0) !== 0);
}

const LATELY = 4;

type Share = "quarter" | "half" | "all";
const SHARES: readonly Share[] = ["quarter", "half", "all"];

/** A share of a pocket in whole major units, or all of it. */
function shareOf(pocket: number, share: Share): number {
  if (share === "all") return pocket;
  const part = share === "half" ? Math.floor(pocket / 2) : Math.floor(pocket / 4);
  return Math.floor(part / 100) * 100;
}

function currencyWords(currency: Currency): string {
  return say(`ui.currency.${currency}`);
}

/** A change already pointed somewhere: from a row of money held, or from the gap's way. */
interface ChangeStart {
  from: Currency;
  to: Currency;
}

function ChangeChooser({ onAsk, start }: { onAsk: ReturnType<typeof useAsk>["open"]; start?: ChangeStart }) {
  const view = useView();
  const currencies = dealtIn(view);
  const [via, setVia] = useState<"bank" | "aboki">("bank");
  const pocketOf = (currency: Currency) => (via === "bank" ? view.pockets[currency].bank : view.pockets[currency].cash);
  const [from, setFrom] = useState<Currency>(start?.from ?? "NGN");
  const [chosenTo, setTo] = useState<Currency>(start?.to ?? "GBP");
  const [share, setShare] = useState<Share>("quarter");
  const to = chosenTo === from ? (currencies.find((currency) => currency !== from) ?? "NGN") : chosenTo;
  const amount = shareOf(pocketOf(from), share);
  // Pointed from a row or the gap above, the chooser opens at the foot of the app: bring it into view.
  const shown = useRef<HTMLDivElement>(null);
  const pointed = start !== undefined;
  useEffect(() => {
    if (pointed && typeof shown.current?.scrollIntoView === "function") shown.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pointed]);
  return (
    <div ref={shown} className="mt-3 flex flex-col gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 p-3" data-chooser="change">
      <Chips shown label={phoneWords("phone.bank.where")} value={via} onChange={setVia} options={[{ value: "bank", label: say("ui.wallet.via.bank") }, { value: "aboki", label: say("ui.wallet.via.aboki") }]} />
      <Chips shown label={phoneWords("phone.bank.from")} value={from} onChange={setFrom} options={currencies.map((currency) => ({ value: currency, label: currencyWords(currency) }))} />
      <Chips shown label={phoneWords("phone.bank.into")} value={to} onChange={setTo} options={currencies.filter((currency) => currency !== from).map((currency) => ({ value: currency, label: currencyWords(currency) }))} />
      <Chips shown label={phoneWords("phone.bank.how-much")} value={share} onChange={setShare} options={SHARES.map((value) => ({ value, label: phoneWords(`phone.bank.${value}`) }))} />
      {amount <= 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.bank.nothing")}</p>
      ) : (
        <button
          type="button"
          className="btn-main"
          data-go="change"
          onClick={() =>
            onAsk({
              form: "card",
              icon: "arrow-left-right",
              who: phoneWords(`phone.bank.change.who.${via}`),
              title: say("ui.wallet.convert"),
              line: phoneWords("phone.bank.change.line", { amount: formatMoney(amount, from), currency: lowerFirst(currencyWords(to)) }),
              cost: { amount, currency: from },
              button: phoneWords("phone.bank.change.button"),
              have: pocketOf(from),
              command: { type: "wallet/convert", from, to, amount, via },
              done: phoneWords("phone.bank.changed"),
            })
          }
        >
          <span>{phoneWords("phone.bank.go", { amount: formatMoney(amount, from) })}</span>
        </button>
      )}
    </div>
  );
}

function MoveChooser({ onAsk }: { onAsk: ReturnType<typeof useAsk>["open"] }) {
  const view = useView();
  const currencies = dealtIn(view);
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [to, setTo] = useState<Pocket>("bank");
  const [share, setShare] = useState<Share>("quarter");
  const source = to === "bank" ? view.pockets[currency].cash : view.pockets[currency].bank;
  const amount = shareOf(source, share);
  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 p-3" data-chooser="move">
      <Chips shown label={say("ui.wallet.currency")} value={currency} onChange={setCurrency} options={currencies.map((value) => ({ value, label: currencyWords(value) }))} />
      <Chips shown label={say("ui.wallet.to")} value={to} onChange={setTo} options={[{ value: "bank", label: phoneWords("phone.bank.to-bank") }, { value: "cash", label: phoneWords("phone.bank.to-cash") }]} />
      <Chips shown label={phoneWords("phone.bank.how-much")} value={share} onChange={setShare} options={SHARES.map((value) => ({ value, label: phoneWords(`phone.bank.${value}`) }))} />
      {amount <= 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.bank.nothing")}</p>
      ) : (
        <button
          type="button"
          className="btn-main"
          data-go="move"
          onClick={() =>
            onAsk({
              form: "card",
              icon: "move-vertical",
              who: phoneWords("phone.bank.move.who"),
              title: say("ui.wallet.move"),
              line: phoneWords(`phone.bank.move.line.${to}`, { amount: formatMoney(amount, currency) }),
              cost: null,
              button: phoneWords("phone.bank.move.button"),
              have: source,
              command: { type: "wallet/move", currency, amount, to },
              done: phoneWords("phone.bank.moved"),
            })
          }
        >
          <span>{phoneWords("phone.bank.go", { amount: formatMoney(amount, currency) })}</span>
        </button>
      )}
    </div>
  );
}

/** Abroad, a month whose dues pass the country's money held: the gap, then the way to close it. */
function DuesGapCard({ onChange }: { onChange: (start: ChangeStart) => void }) {
  const view = useView();
  const gap = duesGap(view);
  if (gap === null) return null;
  const from = changeFirst(gap.from);
  return (
    <div className="mb-3 rounded-[6px] border-l-4 border-out bg-sheet-2 px-3 py-2.5" role="alert" data-dues-gap={gap.currency}>
      <p className="text-[15px] font-bold">{abroadWords("phone.bank.dues", { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) })}</p>
      {from === null ? null : (
        <button type="button" className="press mt-2 flex min-h-11 w-full items-center gap-2 rounded-[5px] btn-dark px-3 text-left text-[14px] font-bold" onClick={() => onChange({ from, to: gap.currency })}>
          <ArrowLeftRight size={16} className="shrink-0" aria-hidden />
          <span>{abroadWords("phone.bank.dues.way", { from: currencyList(gap.from), to: lowerFirst(currencyWords(gap.currency)) })}</span>
        </button>
      )}
    </div>
  );
}

/** Abroad, each other money held as a row with its own Change money into the country's money. */
function HeldElsewhere({ local, onChange }: { local: Currency; onChange: (start: ChangeStart) => void }) {
  const view = useView();
  const held = heldElsewhere(view, local);
  if (held.length === 0) return null;
  return (
    <>
      <Head>{abroadWords("phone.bank.held")}</Head>
      <ul className="flex flex-col divide-y divide-sheet-line">
        {held.map((currency) => (
          <li key={currency} className="flex items-center justify-between gap-3 py-2" data-held={currency}>
            <span className="min-w-0">
              <span className="block text-[13px] text-text-2">{currencyWords(currency)}</span>
              <span className="num block text-[17px]">{formatMoney(view.pockets[currency].bank + view.pockets[currency].cash, currency)}</span>
            </span>
            <button type="button" className="press flex min-h-10 shrink-0 items-center gap-1.5 rounded-[5px] border border-sheet-line bg-sheet-2 px-3 text-[13px] font-bold" onClick={() => onChange({ from: currency, to: local })}>
              <ArrowLeftRight size={15} aria-hidden />
              {say("ui.wallet.convert")}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Bank() {
  const view = useView();
  const { open, sheet } = useAsk();
  const [choosing, setChoosing] = useState<"change" | "move" | null>(null);
  const [start, setStart] = useState<ChangeStart | undefined>(undefined);
  // The money the character lives on: the naira at home, the country's own abroad (R-WORLD-002).
  const local = localCurrency(view);
  const abroad = local !== null && local !== "NGN";
  const shown: Currency = abroad ? local : "NGN";
  // Once flown, the move is made: its target goes.
  const savings = abroad ? null : savingsOf(view);
  const lastMonth = useGame((state) => state.lastMonthLines);
  const thisMonth = useGame((state) => state.monthLines);
  const lately = latelyLines(view, lastMonth, thisMonth).slice(-LATELY);
  const others = CURRENCIES.filter((currency) => currency !== "NGN" && view.pockets[currency].bank + view.pockets[currency].cash > 0);
  const toggle = (which: "change" | "move") => {
    setStart(undefined);
    setChoosing(choosing === which ? null : which);
  };
  const changeFrom = (pointed: ChangeStart) => {
    setStart(pointed);
    setChoosing("change");
  };

  return (
    <div data-phone-app="bank">
      {abroad && !view.ended ? <DuesGapCard onChange={changeFrom} /> : null}
      <div className="band rounded-[6px] px-4 py-3" data-bank-balance={shown}>
        <div className="label label-strong">{phoneWords("phone.bank.balance")}</div>
        <Counter value={view.pockets[shown].bank} format={(value) => formatMoney(value, shown)} className="block text-[34px] leading-tight" />
        <div className="text-[13px] opacity-85">{phoneWords("phone.bank.cash", { amount: formatMoney(view.pockets[shown].cash, shown) })}</div>
        {abroad || others.length === 0 ? null : (
          <div className="text-[13px] opacity-85">{phoneWords("phone.bank.also", { amounts: others.map((currency) => formatMoney(view.pockets[currency].bank + view.pockets[currency].cash, currency)).join(", ") })}</div>
        )}
      </div>
      {abroad && !view.ended ? <HeldElsewhere local={local} onChange={changeFrom} /> : null}

      {abroad ? null : (
        <>
          <Head>{phoneWords("phone.bank.savings")}</Head>
          {savings === null ? (
            <p className="text-[14px] text-text-2">{phoneWords("phone.bank.savings.none")}</p>
          ) : (
            <div data-savings>
              <div className="h-2.5 overflow-hidden rounded-full bg-sheet-muted" role="progressbar" aria-valuemin={0} aria-valuemax={savings.required} aria-valuenow={Math.min(savings.shown, savings.required)} aria-label={phoneWords("phone.bank.savings")}>
                <div className="h-full rounded-full bg-in" style={{ width: `${String(Math.min(100, Math.floor((savings.shown * 100) / savings.required)))}%` }} />
              </div>
              <p className="num mt-1 text-[15px]">{phoneWords("phone.bank.savings.line", { shown: formatMoney(savings.shown, savings.currency), required: formatMoney(savings.required, savings.currency) })}</p>
            </div>
          )}
        </>
      )}

      <Head>{phoneWords("phone.bank.lines")}</Head>
      {lately.length === 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.bank.lines.none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-sheet-line" data-money-lines>
          {lately.map((line, index) => (
            <li key={`${line.key}-${String(index)}`} className={`py-1.5 text-[14px] ${line.tone === "good" ? "text-in" : line.tone === "bad" ? "text-out" : "text-text"}`}>
              {words(line.key, line.params)}
            </li>
          ))}
        </ul>
      )}

      {view.ended ? null : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className={`press flex min-h-12 items-center justify-center gap-2 rounded-[6px] text-[14px] font-bold ${choosing === "change" ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`} aria-expanded={choosing === "change"} onClick={() => toggle("change")}>
              <ArrowLeftRight size={17} aria-hidden />
              {say("ui.wallet.convert")}
            </button>
            <button type="button" className={`press flex min-h-12 items-center justify-center gap-2 rounded-[6px] text-[14px] font-bold ${choosing === "move" ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`} aria-expanded={choosing === "move"} onClick={() => toggle("move")}>
              <MoveVertical size={17} aria-hidden />
              {say("ui.wallet.move")}
            </button>
          </div>
          {choosing === "change" ? <ChangeChooser key={start === undefined ? "free" : `${start.from}-${start.to}`} onAsk={open} {...(start === undefined ? {} : { start })} /> : choosing === "move" ? <MoveChooser onAsk={open} /> : null}
        </>
      )}
      {sheet}
    </div>
  );
}
