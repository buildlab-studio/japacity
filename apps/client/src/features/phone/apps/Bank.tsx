// Bank (docs/rules/world.md R-WORLD-018, 019): the balance as a counter, what is saved toward the
// move, the last few money lines, and the two acts the wallet offers, Change money and Move money,
// each chosen with a few chips and confirmed on its own card. Abroad the country's money stands
// first, the naira and the dollars after it each with Change money, and a month whose dues pass the
// country's money held leads with the gap and the way. Once flown, the
// move's target is gone.
import { content } from "@japacity/content";
import { int, type Currency, type ForeignCurrency, type PlayerView, type Pocket, type ReportLine } from "@japacity/sim";
import { ArrowLeftRight, CircleAlert, MoveVertical, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { changeQuote } from "../../../shared/words/cost";
import { duesGap, heldElsewhere } from "../../../shared/words/dues";
import { REMIT_CHANNELS, remitQuote, type RemitChannel } from "../../../shared/sim/remit";
import { CURRENCIES, formatBp, formatMoney, HOME_CURRENCIES } from "../../../shared/words/format";
import { chargeShown, type MoneyLine, moneyLines } from "../../../shared/words/money";
import { lowerFirst, say, words } from "../../../shared/words/text";
import { savedFor, savingsOf, savingsRoute } from "../../../shared/words/savings";
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

/** The savings figures, shared with the results sheet (R-WORLD-019); kept here for the Bank's own tests. */
export { savedFor, savingsOf };

/**
 * The money that moved lately, newest last: the month just ended whole, as its results list it (its
 * mid-month moves and its end, in the results' order), then this month's moves so far. One source with
 * the results (shared/words/money.ts, `moneyLines`), so the two never differ (R-WORLD-019; the
 * : a payment split across pockets is one line, a bill's "paid this month" is the same
 * money, a fare paid on the way is a move, a change at the bank is told as the results tell it.
 */
export function latelyMoney(view: Pick<PlayerView, "report">, lastMonth: readonly ReportLine[], thisMonth: readonly ReportLine[]): MoneyLine[] {
  const ended = view.report === null ? [] : moneyLines([...lastMonth, ...view.report.lines]);
  return [...ended, ...moneyLines(thisMonth)];
}

/**
 * How the savings are said: what is held of the figure, or once it is met, that it is enough and what the figure is
 * for, the fees alone or the funds to show and the fees (R-WORLD-019).
 */
function savingsKey(view: PlayerView, savings: { shown: number; required: number }): string {
  if (savings.shown < savings.required) return "phone.bank.savings.line";
  const route = savingsRoute(view);
  const funds = (route === null ? [] : (content.route[route.id]?.checklist ?? [])).some((item) => item.requirement.type === "route/funds");
  return funds ? "phone.bank.savings.met.funds" : "phone.bank.savings.met.fees";
}

/** Lately's lines as the report's lines, in Lately's order. */
export function latelyLines(view: Pick<PlayerView, "report">, lastMonth: readonly ReportLine[], thisMonth: readonly ReportLine[]): ReportLine[] {
  return latelyMoney(view, lastMonth, thisMonth).map((entry) => entry.line);
}

type Share = "quarter" | "half" | "all";
const SHARES: readonly Share[] = ["quarter", "half", "all"];
/** A change's amount: a share of the pocket, or as much as the bank's monthly limit lets it take. */
type ChangeShare = Share | "limit";

/** A share of a pocket in whole major units, or all of it. */
function shareOf(pocket: number, share: Share): number {
  if (share === "all") return pocket;
  const part = share === "half" ? Math.floor(pocket / 2) : Math.floor(pocket / 4);
  return Math.floor(part / 100) * 100;
}

/**
 * The most the bank will change into foreign money now, in whole units of the money paid in, by
 * the month's limit (R-WALLET-005): the bank's charge comes off first and what is left is counted
 * in US cents at the official rate, as the wallet counts it. Null where no limit binds: a sale for
 * naira, the FX man, or abroad, where the view shows no limit.
 */
export function bankLimit(view: Pick<PlayerView, "rates" | "bankAllowanceLeft">, from: Currency, to: Currency): number | null {
  const left = view.bankAllowanceLeft;
  if (left === null || to === "NGN") return null;
  if (left === 0) return 0;
  const official = Object.fromEntries(Object.entries(view.rates).map(([currency, rate]) => [currency, rate.official])) as Record<ForeignCurrency, number>;
  const cents = (amount: number) => int.convertMinor(amount - int.bp(amount, content.tuning.wallet.bankChargeBp), from, "USD", official);
  // Whole units: the most whose cents fit what is left, found by halving (cents only grow with the amount).
  let low = 0;
  let high = 1;
  while (cents(high * 100) <= left) high *= 2;
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (cents(middle * 100) <= left) low = middle;
    else high = middle;
  }
  return low * 100;
}

/** The amounts offered for a change: the limit's remainder first where the bank's limit binds, then the shares it would take. */
function changeShares(pocket: number, limit: number | null): { share: ChangeShare; amount: number }[] {
  const shares = SHARES.map((share): { share: ChangeShare; amount: number } => ({ share, amount: shareOf(pocket, share) })).filter((option) => option.amount > 0);
  if (limit === null) return shares;
  const most = Math.min(limit, pocket);
  if (most <= 0) return [];
  const under = shares.filter((option) => option.amount < most);
  return [{ share: "limit", amount: most }, ...under];
}

function currencyWords(currency: Currency): string {
  return say(`ui.currency.${currency}`);
}

/**
 * What a change says before it is confirmed: what goes in, what comes out
 * in the other money, and what that money comes to after, worked as the wallet works it. It reads the
 * pocket the change is paid from and lands in, as the button does: the bank at the bank, the cash with
 * the FX man. What is left of the money paid is the button's to say, once.
 */
export function changeLine(view: Pick<PlayerView, "rates" | "pockets">, from: Currency, to: Currency, amount: number, via: "bank" | "aboki"): string {
  const { got, charge } = changeQuote(view, from, to, amount, via);
  const held = via === "bank" ? view.pockets[to].bank : view.pockets[to].cash;
  return [
    say("ui.wallet.change.line", { amount: formatMoney(amount, from), currency: lowerFirst(currencyWords(to)) }),
    // A charge that rounds to nothing is not said: "The bank's charge is £0".
    via === "aboki"
      ? say("ui.wallet.change.get.aboki", { got: formatMoney(got.amount, to) })
      : say(chargeShown(charge.amount, from) ? "ui.wallet.change.get.bank" : "ui.wallet.change.get.bank-small", { got: formatMoney(got.amount, to), charge: formatMoney(charge.amount, from) }),
    // With none of that money there before, what you get is what you hold: said once.
    ...(held === 0 ? [] : [say(`ui.wallet.change.after.${via}`, { to: formatMoney(held + got.amount, to) })]),
  ].join(" ");
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
  const [chosenShare, setShare] = useState<ChangeShare>("quarter");
  const to = chosenTo === from ? (currencies.find((currency) => currency !== from) ?? "NGN") : chosenTo;
  // R-WALLET-005: at the bank at home the chips offer only what the month's limit lets it take, the limit's remainder first.
  const limit = via === "bank" ? bankLimit(view, from, to) : null;
  const offered = changeShares(pocketOf(from), limit);
  const share = offered.find((option) => option.share === chosenShare) ?? offered.find((option) => option.share === "quarter") ?? offered[0] ?? null;
  const amount = share?.amount ?? 0;
  // A refusal is said beside the button that sent it, never at the top of the phone out of sight.
  const rejection = useGame((state) => state.rejection);
  const dismiss = useGame((state) => state.dismissRejection);
  const [asked, setAsked] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => {
    if (!asked || rejection === null) return;
    setRefused(rejection.words);
    dismiss();
  }, [asked, rejection, dismiss]);
  const said = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (refused !== null && typeof said.current?.scrollIntoView === "function") said.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [refused]);
  // Pointed from a row or the gap above, the chooser opens at the foot of the app: bring it into view.
  const shown = useRef<HTMLDivElement>(null);
  const pointed = start !== undefined;
  useEffect(() => {
    if (pointed && typeof shown.current?.scrollIntoView === "function") shown.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pointed]);
  const pick = <T,>(set: (value: T) => void) => (value: T) => {
    setRefused(null);
    set(value);
  };
  return (
    <div ref={shown} className="mt-3 flex flex-col gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 p-3" data-chooser="change">
      <Chips shown label={phoneWords("phone.bank.where")} value={via} onChange={pick(setVia)} options={[{ value: "bank", label: say("ui.wallet.via.bank") }, { value: "aboki", label: say("ui.wallet.via.aboki") }]} />
      <Chips shown label={phoneWords("phone.bank.from")} value={from} onChange={pick(setFrom)} options={currencies.map((currency) => ({ value: currency, label: currencyWords(currency) }))} />
      <Chips shown label={phoneWords("phone.bank.into")} value={to} onChange={pick(setTo)} options={currencies.filter((currency) => currency !== from).map((currency) => ({ value: currency, label: currencyWords(currency) }))} />
      {offered.length === 0 ? null : <Chips shown label={phoneWords("phone.bank.how-much")} value={share?.share ?? "quarter"} onChange={pick(setShare)} options={offered.map((option) => ({ value: option.share, label: phoneWords(`phone.bank.${option.share}`) }))} />}
      {limit === null ? null : (
        <p className="text-[14px] leading-snug" data-bank-limit={limit}>
          {limit === 0 ? phoneWords("phone.bank.limit.none") : phoneWords("phone.bank.limit.line", { amount: formatMoney(limit, from) })}
        </p>
      )}
      {amount <= 0 ? (
        limit === 0 ? null : <p className="text-[14px] text-text-2">{phoneWords("phone.bank.nothing")}</p>
      ) : (
        <button
          type="button"
          className="btn-main"
          data-go="change"
          onClick={() => {
            dismiss();
            setRefused(null);
            setAsked(true);
            onAsk({
              form: "card",
              icon: "arrow-left-right",
              who: phoneWords(`phone.bank.change.who.${via}`),
              title: say("ui.wallet.convert"),
              line: changeLine(view, from, to, amount, via),
              cost: { amount, currency: from },
              button: phoneWords("phone.bank.change.button"),
              have: pocketOf(from),
              command: { type: "wallet/convert", from, to, amount, via },
              done: phoneWords("phone.bank.changed"),
            });
          }}
        >
          <span>{phoneWords("phone.bank.go", { amount: formatMoney(amount, from) })}</span>
        </button>
      )}
      {refused === null ? null : (
        <p ref={said} role="alert" className="flex items-start gap-2 text-[14px] text-out" data-refused>
          <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
          <span>{refused}</span>
        </p>
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
              // A move between pockets is done at once: the cash is in hand now.
              when: "now",
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

/** Foreign money in a bank abroad that can be sent home, the country's own first. */
function sendable(view: Pick<PlayerView, "pockets" | "place">): ForeignCurrency[] {
  const local = localCurrency(view);
  const held = CURRENCIES.filter((currency): currency is ForeignCurrency => currency !== "NGN" && view.pockets[currency].bank > 0);
  return [...held.filter((currency) => currency === local), ...held.filter((currency) => currency !== local)];
}

/** What one unit of the money sent buys at home by each channel, as the wallet pays it (R-ABROAD-008). */
function rateBy(view: Pick<PlayerView, "rates">, currency: ForeignCurrency, channel: RemitChannel): number {
  // The rate before any fee: what one unit buys, the fee being said on its own.
  const { official, street } = view.rates[currency];
  const { appMarginBp } = content.tuning.remit;
  return channel === "informal" ? street : channel === "app" ? official - int.bp(official, appMarginBp) : official;
}

/**
 * Send money home (R-ABROAD-006, R-WORLD-006): the channels each with what
 * they cost and how fast they land, an amount with the rate, the naira that lands and what is left
 * here, then one card whose button says the amount. The money leaves at once whichever way it goes;
 * the bank's transfer lands next month, and the card says so.
 */
function SendChooser({ onAsk }: { onAsk: ReturnType<typeof useAsk>["open"] }) {
  const view = useView();
  const options = sendable(view);
  const [chosen, setCurrency] = useState<ForeignCurrency | null>(options[0] ?? null);
  const [channel, setChannel] = useState<RemitChannel>("app");
  const [share, setShare] = useState<Share>("quarter");
  const currency = chosen !== null && options.includes(chosen) ? chosen : (options[0] ?? null);
  if (currency === null) return <p className="mt-3 text-[14px] text-text-2" data-chooser="send">{say("ui.remit.nothing")}</p>;
  const amount = shareOf(view.pockets[currency].bank, share);
  const quote = amount > 0 ? remitQuote(view.rates, content.tuning.remit, currency, amount) : null;
  const terms = quote?.[channel] ?? null;
  const sent = formatMoney(amount, currency);
  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-[6px] border border-sheet-line bg-sheet-2 p-3" data-chooser="send">
      {options.length > 1 ? <Chips shown label={say("ui.wallet.currency")} value={currency} onChange={setCurrency} options={options.map((value) => ({ value, label: currencyWords(value) }))} /> : null}
      <div role="radiogroup" aria-label={say("ui.remit.channel")} className="flex flex-col gap-1.5">
        <span className="label text-[10px] text-text-2" aria-hidden>
          {say("ui.remit.channel")}
        </span>
        {REMIT_CHANNELS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === channel}
            onClick={() => setChannel(option)}
            data-channel={option}
            className={`press flex flex-col items-start gap-0.5 rounded-[5px] px-3 py-2 text-left ${option === channel ? "btn-dark" : "border border-sheet-line bg-sheet-2 text-text"}`}
          >
            <span className="text-[14px] font-bold">{say(`ui.remit.channel.${option}`)}</span>
            <span className="text-[13px] leading-snug opacity-85">{say(`ui.remit.terms.${option}${option !== "informal" && feeBp(option) === 0 ? ".free" : ""}`, { fee: formatBp(feeBp(option)), loss: formatBp(content.tuning.remit.informalLossBp) })}</span>
          </button>
        ))}
      </div>
      <Chips shown label={phoneWords("phone.bank.how-much")} value={share} onChange={setShare} options={SHARES.map((value) => ({ value, label: phoneWords(`phone.bank.${value}`) }))} />
      {terms === null || terms.naira === 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.bank.nothing")}</p>
      ) : (
        <>
          <p className="text-[14px] leading-snug" data-send-quote>
            {say("ui.remit.quote", { one: formatMoney(100, currency), rate: formatMoney(rateBy(view, currency, channel), "NGN"), naira: formatMoney(terms.naira, "NGN") })}
          </p>
          <button
            type="button"
            className="btn-main"
            data-go="send"
            onClick={() =>
              onAsk({
                form: "card",
                icon: "landmark",
                who: say("ui.remit.who"),
                title: say("ui.remit.title"),
                line: say(`ui.remit.line.${channel}${channel !== "informal" && terms.fee === 0 ? ".free" : ""}`, { sent, naira: formatMoney(terms.naira, "NGN"), fee: formatMoney(terms.fee, currency) }),
                cost: { amount, currency },
                button: say("ui.remit.go", { amount: sent }),
                when: "now",
                command: { type: "wallet/remit", currency, amount, channel },
                done: say(channel === "bank" ? "ui.remit.sent-later" : "ui.remit.sent"),
              })
            }
          >
            <span>{say("ui.remit.go", { amount: sent })}</span>
          </button>
        </>
      )}
    </div>
  );
}

/** A channel's fee, in basis points of the amount sent (R-ABROAD-006). */
function feeBp(channel: RemitChannel): number {
  const { appFeeBp, bankFeeBp } = content.tuning.remit;
  return channel === "app" ? appFeeBp : channel === "bank" ? bankFeeBp : 0;
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
          <span>{opening(abroadWords("phone.bank.dues.way", { from: currencyList(gap.from), to: lowerFirst(currencyWords(gap.currency)) }))}</span>
        </button>
      )}
    </div>
  );
}

/** A pair's words open a line of their own with a capital. */
function opening(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Abroad, each other money held as a row under one Change money, with its pair into the country's money. */
function HeldElsewhere({ local, onChange }: { local: Currency; onChange: (start: ChangeStart) => void }) {
  const view = useView();
  const held = heldElsewhere(view, local);
  if (held.length === 0) return null;
  return (
    <div data-change-pairs>
      <Head>{say("ui.wallet.convert")}</Head>
      <ul className="flex flex-col divide-y divide-sheet-line">
        {held.map((currency) => (
          <li key={currency} className="flex items-center justify-between gap-3 py-2" data-held={currency}>
            <span className="min-w-0">
              <span className="block text-[13px] text-text-2">{currencyWords(currency)}</span>
              <span className="num block text-[17px]">{formatMoney(view.pockets[currency].bank + view.pockets[currency].cash, currency)}</span>
            </span>
            <button type="button" className="press flex min-h-10 shrink-0 items-center gap-1.5 rounded-[5px] border border-sheet-line bg-sheet-2 px-3 text-[13px] font-bold" onClick={() => onChange({ from: currency, to: local })}>
              <ArrowLeftRight size={15} aria-hidden />
              {abroadWords("phone.bank.pair", { from: currencyWords(currency), to: lowerFirst(currencyWords(local)) })}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `opening`: a chooser to open on, as the room's phone opens Send money home. */
export function Bank({ opening: openOn = null }: { opening?: "change" | "move" | "send" | null } = {}) {
  const view = useView();
  const { open, sheet } = useAsk();
  const [choosing, setChoosing] = useState<"change" | "move" | "send" | null>(openOn);
  const [start, setStart] = useState<ChangeStart | undefined>(undefined);
  // The money the character lives on: the naira at home, the country's own abroad (R-WORLD-002).
  const local = localCurrency(view);
  const abroad = local !== null && local !== "NGN";
  const shown: Currency = abroad ? local : "NGN";
  // Once flown, the move is made: its target goes.
  const savings = abroad ? null : savingsOf(view);
  const lastMonth = useGame((state) => state.lastMonthLines);
  const thisMonth = useGame((state) => state.monthLines);
  const lately = latelyMoney(view, lastMonth, thisMonth);
  const others = CURRENCIES.filter((currency) => currency !== "NGN" && view.pockets[currency].bank + view.pockets[currency].cash > 0);
  const pairsShown = abroad && heldElsewhere(view, local).length > 0;
  const toggle = (which: "change" | "move" | "send") => {
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
          // Each other money says where it is held, the bank or cash.
          <div className="text-[13px] opacity-85" data-bank-also>
            {phoneWords("phone.bank.also", {
              amounts: others
                .flatMap((currency) => (["bank", "cash"] as const).filter((pocket) => view.pockets[currency][pocket] > 0).map((pocket) => phoneWords(`phone.bank.also.${pocket}`, { amount: formatMoney(view.pockets[currency][pocket], currency) })))
                .join(", "),
            })}
          </div>
        )}
      </div>
      {abroad && !view.ended ? <HeldElsewhere local={local} onChange={changeFrom} /> : null}

      {abroad ? null : (
        <>
          <Head>{phoneWords("phone.bank.savings")}</Head>
          {savings === null ? (
            <p className="text-[14px] text-text-2">{phoneWords(view.plan.route === null ? "phone.bank.savings.none" : "phone.bank.savings.paid")}</p>
          ) : (
            <div data-savings>
              <div className="h-2.5 overflow-hidden rounded-[2px] bg-sheet-muted" role="progressbar" aria-valuemin={0} aria-valuemax={savings.required} aria-valuenow={Math.min(savings.shown, savings.required)} aria-label={phoneWords("phone.bank.savings")}>
                <div className="h-full rounded-[2px] bg-in" style={{ width: `${String(Math.min(100, Math.floor((savings.shown * 100) / savings.required)))}%` }} />
              </div>
              <p className="num mt-1 text-[15px]" data-savings-met={savings.shown >= savings.required ? "true" : undefined}>
                {phoneWords(savingsKey(view, savings), { shown: formatMoney(savings.shown, savings.currency), required: formatMoney(savings.required, savings.currency) })}
              </p>
            </div>
          )}
        </>
      )}

      <Head>{phoneWords("phone.bank.lines")}</Head>
      {lately.length === 0 ? (
        <p className="text-[14px] text-text-2">{phoneWords("phone.bank.lines.none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-sheet-line" data-money-lines>
          {lately.map(({ line, sign }, index) => (
            <li key={`${line.key}-${String(index)}`} className={`py-1.5 text-[14px] ${sign > 0 ? "text-in" : "text-out"}`} data-sign={sign}>
              {words(line.key, line.params)}
            </li>
          ))}
        </ul>
      )}

      {view.ended ? null : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {/* Abroad with other monies held, Change money heads their pairs above; it is not said again here. */}
            {pairsShown ? null : (
              <button type="button" className={`press flex min-h-12 items-center justify-center gap-2 rounded-[6px] text-[14px] font-bold ${choosing === "change" ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`} aria-expanded={choosing === "change"} onClick={() => toggle("change")}>
                <ArrowLeftRight size={17} aria-hidden />
                {say("ui.wallet.convert")}
              </button>
            )}
            <button type="button" className={`press flex min-h-12 items-center justify-center gap-2 rounded-[6px] text-[14px] font-bold ${choosing === "move" ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`} aria-expanded={choosing === "move"} onClick={() => toggle("move")}>
              <MoveVertical size={17} aria-hidden />
              {say("ui.wallet.move")}
            </button>
          </div>
          {abroad ? (
            <button type="button" className={`press mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[6px] text-[14px] font-bold ${choosing === "send" ? "btn-dark" : "border border-sheet-line bg-sheet-2"}`} aria-expanded={choosing === "send"} onClick={() => toggle("send")} data-bank-act="send">
              <Send size={17} aria-hidden />
              {say("ui.remit.title")}
            </button>
          ) : null}
          {choosing === "change" ? <ChangeChooser key={start === undefined ? "free" : `${start.from}-${start.to}`} onAsk={open} {...(start === undefined ? {} : { start })} /> : choosing === "move" ? <MoveChooser onAsk={open} /> : choosing === "send" ? <SendChooser onAsk={open} /> : null}
        </>
      )}
      {sheet}
    </div>
  );
}
