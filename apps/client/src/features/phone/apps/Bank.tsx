// Bank (world:phone-rises-over-scene, world:phone-holds-what-phones-hold): at home it opens on the passbook: the money held for the road against
// the plan's whole cost, the stamps as stickers, last
// month in and out as chips, the roads as cards with one tap each and the pace line, every figure the simulation's. Behind
// it, in the same dress, the rest of the bank: what is saved toward the move in the way's own money, the last money lines,
// and the two acts the wallet offers, Change money and Move money, each chosen with a few chips and confirmed on its own
// card. Abroad the country's money stands first, the naira and the dollars after it each with Change money, and a month
// whose dues pass the country's money held leads with the gap and the way. Once flown, the move has no target to save
// toward.
import { content } from "@japacity/content";
import { CURRENCIES, int, REMIT_CHANNELS, remitQuote, type Currency, type ForeignCurrency, type Id, type OfferView, type ReportParam, type PassbookRoad, type PassbookView, type PlayerView, type Pocket, type RemitChannel, type ReportLine } from "@japacity/sim";
import { ArrowLeftRight, ArrowUp, CalendarDays, CircleAlert, Handshake, Landmark, MoveVertical, Send, Smartphone } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { PhoneNav } from "../../../shared/phone/nav";
import { cue } from "../../../shared/sound/cues";
import { Tile } from "../../../shared/tiles/Tile";
import { LookCard } from "../../../shared/ui/look/LookCard";
import { Sticker } from "../../../shared/ui/look/Sticker";
import { StickerChip } from "../../../shared/ui/look/StickerChip";
import { StateTag } from "../../../shared/ui/StateTag";
import type { Tint } from "../../../shared/ui/look/tint";
import { TINTS } from "../../../shared/ui/look/tint";
import { Facts } from "../../../shared/ui/Facts";
import { NeedChips } from "../../../shared/ui/NeedChips";
import { changeQuote } from "../../../shared/words/cost";
import type { Fact } from "../../../shared/words/facts";
import { duesGap, heldElsewhere } from "../../../shared/words/dues";
import { formatMoney, formatOne, formatRate, HOME_CURRENCIES } from "../../../shared/words/format";
import { chargeShown, type MoneyLine, moneyLines } from "../../../shared/words/money";
import { hasWords, inMonths, lowerFirst, nameOf, runningName, say, sayCount, words } from "../../../shared/words/text";
import { savedFor, savingsOf, savingsRoute } from "../../../shared/words/savings";
import { localCurrency } from "../../../shared/words/wayHome";
import { Counter } from "../../../shared/world/TopBand";
import { Chips, useAsk } from "../act";
import { changeFirst, currencyList } from "./abroad";
import { passbookCount, shortNaira } from "./passbook.words";

/** The currencies this life deals in: the home three, and the country's own once abroad. */
function dealtIn(view: Pick<PlayerView, "place">): Currency[] {
  const local = localCurrency(view);
  return HOME_CURRENCIES.includes(local) ? [...HOME_CURRENCIES] : [...HOME_CURRENCIES, local];
}

/** The savings figures, shared with the results sheet (world:phone-holds-what-phones-hold); kept here for the Bank's own tests. */
export { savedFor, savingsOf };

/**
 * The money that moved lately, newest last: the month just ended whole, as its results list it (its
 * mid-month moves and its end, in the results' order), then this month's moves so far. One source with
 * the results (shared/words/money.ts, `moneyLines`), so the two never differ (world:phone-holds-what-phones-hold): a payment
 * split across pockets is one line, a bill's "paid this month" is the same
 * money, a fare paid on the way is a move, a change at the bank is told as the results tell it.
 */
export function latelyMoney(view: Pick<PlayerView, "report">, lastMonth: readonly ReportLine[], thisMonth: readonly ReportLine[]): MoneyLine[] {
  const ended = view.report === null ? [] : moneyLines([...lastMonth, ...view.report.lines]);
  return [...ended, ...moneyLines(thisMonth)];
}

/**
 * A plan is made once the way the chapters follow is looked into or further on. The figure shows from the month the
 * plan is set, as on the results; this only words a plan with no figure yet: a way only heard of, with nothing to
 * count, is still no plan.
 */
function planMade(view: Pick<PlayerView, "plan" | "routes">): boolean {
  const lean = view.plan.route;
  if (lean === null) return false;
  const state = view.routes.find((route) => route.id === lean)?.state ?? "unknown";
  return state !== "unknown" && state !== "heard";
}

/** The line where no figure shows: no plan yet, the employer paying the way, or nothing left to save for. */
function noFigureKey(view: PlayerView): string {
  if (!planMade(view)) return "phone.bank.savings.no-plan";
  const gate = view.routes.find((route) => route.id === view.plan.route)?.gate?.gate;
  return gate === "contract" ? "phone.bank.savings.paid" : "phone.bank.savings.nothing";
}

/**
 * How the savings are said: what is held of the figure, or once it is met, that it is enough and what the figure is
 * for, the fees alone or the funds to show and the fees (world:phone-holds-what-phones-hold), never a held sum "of" a smaller one.
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
 * the month's limit (wallet:monthly-fx-allowance): the bank's charge comes off first and what is left is counted
 * in US cents at the official rate, as the wallet counts it. Null where no limit binds: a sale for
 * naira, the FX man, or abroad, where the view shows no limit. A remainder too small to buy one whole
 * unit of the money bought counts as nothing: twelve cents left come to ₦191 for nine pence, a change
 * the screen can only say as "£0".
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
  const most = low * 100;
  return int.convertMinor(most - int.bp(most, content.tuning.wallet.bankChargeBp), from, to, official) < 100 ? 0 : most;
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
 * the FX man. What is left of the money paid is the button's to say, once, so the two never contradict
 * each other.
 */
export function changeLine(view: Pick<PlayerView, "rates" | "pockets">, from: Currency, to: Currency, amount: number, via: "bank" | "aboki"): string {
  const { got, charge } = changeQuote(view, from, to, amount, via);
  const held = via === "bank" ? view.pockets[to].bank : view.pockets[to].cash;
  return [
    say("ui.wallet.change.line", { amount: formatMoney(amount, from), currency: lowerFirst(currencyWords(to)) }),
    // A charge that rounds to nothing is not said, never "The bank's charge is £0".
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
  // wallet:monthly-fx-allowance: at the bank at home the chips offer only what the month's limit lets it take, the limit's remainder first.
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
    <div ref={shown} className="look-card flex flex-col gap-2.5 p-3" data-chooser="change">
      <Chips shown label={say("phone.bank.where")} value={via} onChange={pick(setVia)} options={[{ value: "bank", label: say("ui.wallet.via.bank") }, { value: "aboki", label: say("ui.wallet.via.aboki") }]} />
      <Chips shown label={say("phone.bank.from")} value={from} onChange={pick(setFrom)} options={currencies.map((currency) => ({ value: currency, label: currencyWords(currency) }))} />
      <Chips shown label={say("phone.bank.into")} value={to} onChange={pick(setTo)} options={currencies.filter((currency) => currency !== from).map((currency) => ({ value: currency, label: currencyWords(currency) }))} />
      {offered.length === 0 ? null : <Chips shown label={say("phone.bank.how-much")} value={share?.share ?? "quarter"} onChange={pick(setShare)} options={offered.map((option) => ({ value: option.share, label: say(`phone.bank.${option.share}`) }))} />}
      {/* text:show-then-tell: the rate and the month's limit as chips; with no limit left, the one line that says so and what still changes. */}
      <div className="flex flex-wrap gap-2">
        <RateLine from={from} to={to} via={via} />
        {limit === null || limit === 0 ? null : (
          <span className="sticker-chip chip-wrap num bg-[var(--soft)] text-[13px]" style={{ rotate: "1.5deg" }} data-bank-limit={limit}>
            <CalendarDays size={14} aria-hidden strokeWidth={2.4} className="shrink-0" />
            <span>{say("phone.bank.limit.line", { amount: formatMoney(limit, from) })}</span>
          </span>
        )}
      </div>
      {limit === 0 ? (
        <p className="text-[14px] leading-snug" data-bank-limit={limit}>
          {say("phone.bank.limit.none")}
        </p>
      ) : null}
      {amount <= 0 ? (
        limit === 0 ? null : <p className="text-[14px] text-text-2">{say("phone.bank.nothing")}</p>
      ) : (
        <button
          type="button"
          className="press-button w-full"
          data-go="change"
          onClick={() => {
            dismiss();
            setRefused(null);
            setAsked(true);
            onAsk({
              form: "card",
              icon: "arrow-left-right",
              who: say(`phone.bank.change.who.${via}`),
              title: say("ui.wallet.convert"),
              line: changeLine(view, from, to, amount, via),
              cost: { amount, currency: from },
              button: say("phone.bank.change.button"),
              have: pocketOf(from),
              command: { type: "wallet/convert", from, to, amount, via },
              done: say("phone.bank.changed"),
            });
          }}
        >
          <span>{say("phone.bank.go", { amount: formatMoney(amount, from) })}</span>
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

/** The rate a change between naira and a foreign money goes at, as a chip: the bank's in whole naira, the FX man's to the kobo. */
function RateLine({ from, to, via }: { from: Currency; to: Currency; via: "bank" | "aboki" }) {
  const view = useView();
  const foreign = from === "NGN" ? to : to === "NGN" ? from : null;
  if (foreign === null || foreign === "NGN") return null;
  const rate = via === "bank" ? formatMoney(view.rates[foreign].official, "NGN") : formatRate(view.rates[foreign].street, "NGN");
  return (
    <span className="sticker-chip chip-wrap num bg-sheet-2 text-[13px]" style={{ rotate: "-1.5deg" }} data-rate={via}>
      <ArrowLeftRight size={14} aria-hidden strokeWidth={2.4} className="shrink-0" />
      <span>{say(`phone.bank.rate.${via}`, { one: formatOne(foreign), rate })}</span>
    </span>
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
    <div className="look-card flex flex-col gap-2.5 p-3" data-chooser="move">
      <Chips shown label={say("ui.wallet.currency")} value={currency} onChange={setCurrency} options={currencies.map((value) => ({ value, label: currencyWords(value) }))} />
      <Chips shown label={say("ui.wallet.to")} value={to} onChange={setTo} options={[{ value: "bank", label: say("phone.bank.to-bank") }, { value: "cash", label: say("phone.bank.to-cash") }]} />
      <Chips shown label={say("phone.bank.how-much")} value={share} onChange={setShare} options={SHARES.map((value) => ({ value, label: say(`phone.bank.${value}`) }))} />
      {amount <= 0 ? (
        <p className="text-[14px] text-text-2">{say("phone.bank.nothing")}</p>
      ) : (
        <button
          type="button"
          className="press-button w-full"
          data-go="move"
          onClick={() =>
            onAsk({
              form: "card",
              icon: "move-vertical",
              who: say("phone.bank.move.who"),
              title: say("ui.wallet.move"),
              line: say(`phone.bank.move.line.${to}`, { amount: formatMoney(amount, currency) }),
              cost: null,
              button: say("phone.bank.move.button"),
              have: source,
              // A move between pockets is done at once: the cash is in hand straight away.
              when: "now",
              command: { type: "wallet/move", currency, amount, to },
              done: say("phone.bank.moved"),
            })
          }
        >
          <span>{say("phone.bank.go.move", { amount: formatMoney(amount, currency) })}</span>
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

/** What one unit of the money sent buys at home by each channel, as the wallet pays it (abroad-money:remit-quote-is-shared). */
function rateBy(view: Pick<PlayerView, "rates">, currency: ForeignCurrency, channel: RemitChannel): number {
  // The rate before any fee: what one unit buys, the fee being said on its own.
  const { official, street } = view.rates[currency];
  const { appMarginBp } = content.tuning.remit;
  return channel === "informal" ? street : channel === "app" ? official - int.bp(official, appMarginBp) : official;
}

/** Each way's picture, drawn from the icon set: the phone's app, the bank, a hand passed to a hand. */
const WAY_ICON: Readonly<Record<RemitChannel, typeof Smartphone>> = { app: Smartphone, bank: Landmark, informal: Handshake };

type Quote = ReturnType<typeof remitQuote>;

/**
 * A way's facts (abroad-money:remit-sends-money-home, text:show-then-tell): its fee in money, never as a share of the sum; its rate; and
 * for the way through someone, that it sometimes never arrives, in words and never as a percentage. `arrives` adds, first, the naira
 * that arrives at home and when, for the card after the choice.
 */
function wayFacts(view: Pick<PlayerView, "rates">, currency: ForeignCurrency, channel: RemitChannel, quote: Quote | null, arrives = false): Fact[] {
  const fee = quote?.[channel].fee ?? 0;
  const free = feeBp(channel) === 0 || (quote !== null && fee === 0);
  const facts: Fact[] = [];
  if (arrives && quote !== null) facts.push({ kind: "pay", words: say("ui.remit.fact.at-home", { naira: formatMoney(quote[channel].naira, "NGN") }) }, { kind: "when", words: say(`ui.remit.fact.arrives.${channel}`) });
  facts.push({ kind: "fee", words: free ? say("ui.remit.fact.no-fee") : say("ui.remit.fact.fee", { fee: formatMoney(fee, currency) }) });
  facts.push({ kind: "rate", words: say("ui.remit.fact.rate", { one: formatMoney(100, currency), rate: formatMoney(rateBy(view, currency, channel), "NGN") }) });
  if (channel === "informal") facts.push({ kind: "catch", words: say("ui.remit.fact.loss") });
  return facts;
}

/** The ways as three tiles side by side, as the ride sheet's ways (world:ride-sheet-shows-fares): the picture, the way, the naira that arrives and when. */
function WayTiles({ quote, channel, onPick }: { quote: Quote | null; channel: RemitChannel; onPick: (channel: RemitChannel) => void }) {
  return (
    <div role="radiogroup" aria-label={say("ui.remit.channel")} className="grid grid-cols-3 gap-2" data-ways="tiles">
      {REMIT_CHANNELS.map((option) => {
        const Icon = WAY_ICON[option];
        const on = option === channel;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(option)}
            data-channel={option}
            className={`press flex min-w-0 flex-col items-center gap-1 rounded-[14px] px-1 pt-2.5 pb-2 text-center ${on ? "ride-way-on" : "ride-way"}`}
          >
            <span className="flex size-9 items-center justify-center chip-pic bg-tint-money">
              <Icon size={19} aria-hidden className="text-[var(--money-ink)]" />
            </span>
            <span className="text-[13px] leading-tight font-bold">{say(`ui.remit.way.${option}`)}</span>
            {quote === null ? null : (
              <span className="num text-[13px] leading-tight font-extrabold" data-arrives>
                {formatMoney(quote[option].naira, "NGN")}
              </span>
            )}
            <span className="text-[12px] leading-tight text-text-2">{say(`ui.remit.when.${option}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Send money home (abroad-money:remit-sends-money-home, world:one-action-one-sheet, world:phone-holds-what-phones-hold): the ways as tiles,
 * as the ride sheet's ways, each with the naira that arrives and when; under them the picked way's fee in money and its rate as chips;
 * then how much, then one card whose button says the sum. The money leaves at once whichever way it goes; by the bank it arrives next
 * month, and the card says so.
 */
function SendChooser({ onAsk }: { onAsk: ReturnType<typeof useAsk>["open"] }) {
  const view = useView();
  const options = sendable(view);
  const [chosen, setCurrency] = useState<ForeignCurrency | null>(options[0] ?? null);
  const [channel, setChannel] = useState<RemitChannel>("app");
  const [share, setShare] = useState<Share>("quarter");
  const currency = chosen !== null && options.includes(chosen) ? chosen : (options[0] ?? null);
  if (currency === null) return <p className="look-card p-3 text-[14px] text-text-2" data-chooser="send">{say("ui.remit.nothing")}</p>;
  const amount = shareOf(view.pockets[currency].bank, share);
  const quote = amount > 0 ? remitQuote(view.rates, content.tuning.remit, currency, amount) : null;
  const terms = quote?.[channel] ?? null;
  const sent = formatMoney(amount, currency);
  return (
    <div className="look-card flex flex-col gap-3 p-3" data-chooser="send">
      {options.length > 1 ? <Chips shown label={say("ui.wallet.currency")} value={currency} onChange={setCurrency} options={options.map((value) => ({ value, label: currencyWords(value) }))} /> : null}
      <span className="label text-text-2" aria-hidden>
        {say("ui.remit.channel")}
      </span>
      <WayTiles quote={quote} channel={channel} onPick={setChannel} />
      <Facts facts={wayFacts(view, currency, channel, quote)} />
      <Chips shown label={say("phone.bank.how-much")} value={share} onChange={setShare} options={SHARES.map((value) => ({ value, label: say(`phone.bank.${value}`) }))} />
      {terms === null || terms.naira === 0 ? (
        <p className="text-[14px] text-text-2">{say("phone.bank.nothing")}</p>
      ) : (
        <button
          type="button"
          className="press-button w-full"
          style={{ justifyContent: "space-between" }}
          data-go="send"
          onClick={() =>
            onAsk({
              form: "card",
              icon: "landmark",
              who: say("ui.remit.who"),
              title: say("ui.remit.title"),
              line: say("ui.remit.line"),
              chips: wayFacts(view, currency, channel, quote, true),
              cost: { amount, currency },
              button: say("ui.remit.go", { amount: sent }),
              when: "now",
              command: { type: "wallet/remit", currency, amount, channel },
              done: say(channel === "bank" ? "ui.remit.sent-later" : "ui.remit.sent"),
            })
          }
        >
          <span>{say("ui.remit.go", { amount: sent })}</span>
          <span className="text-[13px] font-semibold opacity-80">{say(`ui.remit.when.${channel}`)}</span>
        </button>
      )}
    </div>
  );
}

/** A channel's fee, in basis points of the amount sent (abroad-money:remit-sends-money-home). */
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
    <div className="look-card px-3 py-2.5 shadow-[inset_5px_0_0_var(--out)]" role="alert" data-dues-gap={gap.currency}>
      <p className="text-[15px] font-bold">{say("phone.bank.dues", { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) })}</p>
      {from === null ? null : (
        <button type="button" className="press mt-2 flex min-h-11 w-full items-center gap-2 rounded-[14px] btn-dark px-3 text-left text-[14px] font-bold" onClick={() => onChange({ from, to: gap.currency })}>
          <ArrowLeftRight size={16} className="shrink-0" aria-hidden />
          <span>{opening(say("phone.bank.dues.way", { from: currencyList(gap.from), to: lowerFirst(currencyWords(gap.currency)) }))}</span>
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
    <LookCard className="p-3" data-change-pairs>
      <Part>{say("ui.wallet.convert")}</Part>
      <ul className="flex flex-col divide-y divide-sheet-line">
        {held.map((currency) => (
          <li key={currency} className="flex items-center justify-between gap-3 py-2" data-held={currency}>
            <span className="min-w-0">
              <span className="block text-[13px] text-text-2">{currencyWords(currency)}</span>
              <span className="num block text-[17px]">{formatMoney(view.pockets[currency].bank + view.pockets[currency].cash, currency)}</span>
            </span>
            <button type="button" className="press flex min-h-10 shrink-0 items-center gap-1.5 rounded-[12px] border-2 border-edge bg-sheet-2 px-3 text-[13px] font-bold shadow-[0_2px_0_var(--edge)]" onClick={() => onChange({ from: currency, to: local })}>
              <ArrowLeftRight size={15} aria-hidden />
              {say("phone.bank.pair", { from: currencyWords(currency), to: lowerFirst(currencyWords(local)) })}
            </button>
          </li>
        ))}
      </ul>
    </LookCard>
  );
}

// ---------------------------------------------------------------------------
// The passbook: the Bank's first page at home. Every figure is the view's (PlayerView.passbook); nothing is worked here.
// ---------------------------------------------------------------------------

/** A small heading over a part of the page. */
function Part({ children }: { children: string }) {
  return <h3 className="mt-1 mb-2 px-0.5 text-[14px] font-bold text-text-2">{children}</h3>;
}

/** The pace line: the whole money chapter in one sentence, its months in green. */
function paceLine(view: PlayerView, book: PassbookView): { lead: string; months: number | null; best: { words: string; months: number } | null } {
  if (book.target === null) {
    const lean = view.plan.route;
    return { lead: lean === null ? say("passbook.pace.no-plan") : say("passbook.pace.unread", { route: runningName(lean) }), months: null, best: null };
  }
  if (book.months === 0) return { lead: say("passbook.pace.ready"), months: null, best: null };
  const best = book.roads.find((road) => road.road === book.best && road.months !== null) ?? null;
  const bestWords = best === null ? null : { words: withRoad(best), months: best.months ?? 0 };
  if (book.months === null) return { lead: say(book.pace === null ? "passbook.pace.none" : "passbook.pace.stuck"), months: null, best: bestWords };
  return { lead: book.months === 1 ? say("passbook.pace.one") : say("passbook.pace", { months: FIGURE }), months: book.months === 1 ? null : book.months, best: bestWords };
}

/** Where a figure stands in a sentence, so the figure can be drawn apart, in green. */
const FIGURE = "\u0001";

/** "With the mid-level developer job:", the road's own words before its months. */
function withRoad(road: PassbookRoad): string {
  const key = road.road === "family" && road.via !== "activity.ask-family-loan" && road.via !== "offer.family-loan" ? "passbook.with.family-meeting" : `passbook.with.${road.road}`;
  return say(key, { job: runningName(road.via), months: FIGURE }).split(FIGURE)[0] ?? "";
}

/**
 * The pace (wallet:saving-pace, wallet:roads-to-the-target, text:show-then-tell): with a figure, two chips, the months at this pace and
 * the months by the best road, each figure in green; with none, the one line that says what sets the road's cost.
 */
function PaceLine({ view, book }: { view: PlayerView; book: PassbookView }) {
  const line = paceLine(view, book);
  if (line.months === null && line.best === null && book.months !== 1) {
    return (
      <p className="mt-2 text-[14px] leading-snug" data-pace>
        {line.lead}
      </p>
    );
  }
  const [before, after] = line.months === null ? [line.lead, ""] : line.lead.split(FIGURE);
  return (
    <div className="mt-2 flex flex-wrap gap-2" data-pace>
      <span className="sticker-chip chip-wrap bg-tint-study text-[13px]" style={{ rotate: "-1.5deg" }} data-pace-now>
        <CalendarDays size={14} aria-hidden strokeWidth={2.4} className="shrink-0" />
        <span>
          {before}
          {line.months === null ? null : <b className="text-[var(--money-ink)]">{line.months}</b>}
          {after}
        </span>
      </span>
      {line.best === null ? null : (
        <span className="sticker-chip chip-wrap bg-tint-money text-[13px]" style={{ rotate: "1.5deg" }} data-pace-best={line.best.months}>
          <ArrowUp size={14} aria-hidden strokeWidth={2.4} className="shrink-0 text-[var(--money-ink)]" />
          <span>
            {line.best.words}
            <b className="text-[var(--money-ink)]">{line.best.months === 0 ? say("passbook.with.now") : line.best.months}</b>
          </span>
        </span>
      )}
    </div>
  );
}

/** The bar: what is held against the target, the plane where the money has got to. */
function HeldBar({ book }: { book: PassbookView }) {
  if (book.target === null) return null;
  const share = Math.min(100, Math.floor((book.held * 100) / Math.max(1, book.target.total)));
  return (
    <div className="relative mt-2.5 mb-1 h-3.5 rounded-[5px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--sheet-line)]" role="progressbar" aria-valuemin={0} aria-valuemax={book.target.total} aria-valuenow={Math.min(book.held, book.target.total)} aria-label={say("passbook.held")}>
      <div className="h-full rounded-[5px] bg-[var(--tick)] transition-[width] duration-300" style={{ width: `${String(share)}%` }} />
      <span className="absolute -top-3 wobble-in" style={{ left: `calc(${String(share)}% - 14px)` }}>
        <Sticker emoji="✈️" alt="" size={22} tilt={-8} />
      </span>
    </div>
  );
}

/**
 * The other money held, one chip a money, each saying where it is held, the bank or cash, never a bare "Also held: £81".
 * One long chip for them all runs past the card and the phone's glass: a chip a money lets the row wrap between monies,
 * and a chip may wrap inside itself where one money is held in both pockets.
 */
function AlsoHeld({ view, others }: { view: PlayerView; others: Currency[] }) {
  const held = others
    .map((currency) => ({ currency, words: (["bank", "cash"] as const).filter((pocket) => view.pockets[currency][pocket] > 0).map((pocket) => say(`phone.bank.also.${pocket}`, { amount: formatMoney(view.pockets[currency][pocket], currency) })).join(", ") }))
    .filter((each) => each.words !== "");
  if (held.length === 0) return null;
  return (
    <>
      <span className="self-center text-[12px] font-bold text-text-2">{say("phone.bank.also")}</span>
      {held.map((each, index) => (
        <span key={each.currency} className="max-w-full" data-also={each.currency}>
          <StickerChip tilt={index % 2 === 0 ? -1 : 1} className="chip-wrap max-w-full">
            {each.words}
          </StickerChip>
        </span>
      ))}
    </>
  );
}

function PassbookCard({ view, book, shown, others }: { view: PlayerView; book: PassbookView; shown: Currency; others: Currency[] }) {
  return (
    <LookCard className="rise p-3" data-passbook>
      <div className="text-[12px] font-bold text-text-2">{say("passbook.held")}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="num text-[26px] font-bold leading-tight" data-passbook-held={book.held}>
          {formatMoney(book.held, "NGN")}
        </span>
        {book.target === null ? null : (
          <span className="text-[14px] text-text-2" data-passbook-target={book.target.total}>
            {/* One line says its money one way (text.md, money on screen): the road's cost in full, as the held sum beside it. */}
            {say("passbook.of", { target: formatMoney(book.target.total, "NGN") })}
          </span>
        )}
      </div>
      <HeldBar book={book} />
      <PaceLine view={view} book={book} />
      {/* The pockets as chips, each money where it is held. */}
      <div className="mt-2.5 flex flex-wrap gap-1.5" data-bank-balance={shown}>
        <StickerChip tint="plain" tilt={-1.5}>{say("passbook.cash", { amount: formatMoney(view.pockets[shown].cash, shown) })}</StickerChip>
        <StickerChip tint="study" tilt={1.5}>
          <span>{say("passbook.bank")}</span>
          <Counter value={view.pockets[shown].bank} format={(value) => formatMoney(value, shown)} />
        </StickerChip>
        <AlsoHeld view={view} others={others} />
      </div>
    </LookCard>
  );
}

/** The stamps as round stickers: each reached one filled, with its month told; those to come dashed. */
function Stamps({ book }: { book: PassbookView }) {
  if (book.stamps.length === 0) return null;
  return (
    <section data-stamps>
      <Part>{say("passbook.stamps")}</Part>
      <ul className="flex justify-between gap-1 px-1">
        {book.stamps.map((stamp, index) => {
          const reached = stamp.month !== null;
          const caption = stamp.target ? say(reached ? "passbook.stamp.ready" : "passbook.stamp.all-in") : reached ? say("passbook.stamp.heard") : "";
          return (
            <li
              key={`${String(stamp.at)}-${String(stamp.target)}`}
              className={`flex size-[62px] shrink-0 flex-col items-center justify-center rounded-[50%] text-center leading-tight ${reached ? "pop bg-tint-money text-[var(--money-ink)] shadow-[0_0_0_3px_var(--cut),0_0_0_4.5px_var(--money-ink),0_5px_8px_rgba(0,0,0,0.18)]" : "border-2 border-dashed border-text-2/50 text-text-2"}`}
              style={reached ? { rotate: `${String(index % 2 === 0 ? -8 : 6)}deg`, animationDelay: `${String(index * 60)}ms` } : undefined}
              data-stamp={stamp.at}
              data-stamp-reached={reached ? stamp.month : undefined}
              data-stamp-target={stamp.target ? "" : undefined}
            >
              <span className={`text-[14px] font-bold ${reached ? "" : "text-text"}`}>{shortNaira(stamp.at)}</span>
              {caption === "" ? null : <span className="text-[12px] font-semibold">{caption}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Last month's money in and out, each money as its own chip; the lines whole are under Lately. */
function LastMonth({ view, lastMonth }: { view: PlayerView; lastMonth: readonly ReportLine[] }) {
  if (view.report === null) return null;
  const totals = new Map<string, { sign: 1 | -1; currency: Currency; amount: number }>();
  for (const { sign, currency, amount } of moneyLines([...lastMonth, ...view.report.lines])) {
    const key = `${String(sign)}-${currency}`;
    totals.set(key, { sign, currency, amount: (totals.get(key)?.amount ?? 0) + amount });
  }
  const chips = [...totals.values()].filter((each) => each.amount > 0).sort((a, b) => b.sign - a.sign);
  if (chips.length === 0) return null;
  return (
    <section data-last-month>
      <Part>{say("passbook.last-month")}</Part>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, index) => (
          <span key={`${String(chip.sign)}-${chip.currency}`} className="pop" data-last-month-chip={chip.sign > 0 ? "in" : "out"}>
            <StickerChip tint={chip.sign > 0 ? "money" : "plain"} tilt={index % 2 === 0 ? -1.5 : 1}>
              {say(chip.sign > 0 ? "passbook.in" : "passbook.out", { amount: formatMoney(chip.amount, chip.currency) })}
            </StickerChip>
          </span>
        ))}
      </div>
    </section>
  );
}

const ROAD_TINT: Record<PassbookRoad["road"], Tint> = { ladder: "money", side: "money", ajo: "people", family: "people", scholarship: "study" };

/** The offer standing open for a road, from the view. */
function offerOf(view: PlayerView, road: PassbookRoad): OfferView | null {
  return road.offer === null ? null : (view.offers.find((offer) => offer.id === road.offer) ?? null);
}

/**
 * An offer's terms as params for its words: a term an effect moves money by reads as money in that effect's currency,
 * the rest as it came. The road's cards read only the family's and the circle's offers, whose money terms are plain.
 */
function termParams(offer: OfferView): Record<string, ReportParam> {
  const currencies = new Map<string, Currency>();
  for (const choice of content.offer[offer.entry]?.choices ?? []) {
    for (const effect of choice.effects) {
      if ((effect.type === "money/add" || effect.type === "money/take" || effect.type === "route/support") && typeof effect.amount === "object" && "term" in effect.amount) currencies.set(effect.amount.term, effect.currency);
    }
  }
  return Object.fromEntries(
    Object.entries(offer.terms).map(([name, value]): [string, ReportParam] => {
      const currency = currencies.get(name);
      return [name, typeof value === "number" && currency !== undefined ? { currency, amount: value } : value];
    }),
  );
}

/** The choice that takes an offer: the first that does something. */
function takeChoice(offer: OfferView): string | null {
  return content.offer[offer.entry]?.choices.find((choice) => choice.effects.length > 0)?.id ?? null;
}

/** A road's title and its one line, in the passbook's words, from the view's own figures. */
function roadWords(view: PlayerView, road: PassbookRoad): { title: string; line: string } {
  const offer = offerOf(view, road);
  switch (road.road) {
    case "ladder":
    case "side": {
      const pay = content.activity[road.via as keyof typeof content.activity]?.pay;
      const amount = pay === undefined || pay === null || typeof pay.amount !== "number" ? null : formatMoney(pay.amount, pay.currency);
      return { title: nameOf(road.via), line: amount === null ? "" : say(road.road === "ladder" ? "passbook.road.pay" : "passbook.road.side", { amount }) };
    }
    case "ajo": {
      const circle = content.obligation["obligation.ajo"];
      const share = circle?.amount ?? 0;
      const count = circle?.term ?? 0;
      const line = road.state === "taken" ? say("passbook.road.ajo.taken") : road.state === "open" ? say("passbook.road.ajo.open") : say("passbook.road.ajo.line", { share: formatMoney(share, "NGN"), count, pot: formatMoney(share * count, "NGN") });
      return { title: say("passbook.road.ajo"), line };
    }
    case "family": {
      const meeting = road.via === "activity.family-meeting" || (offer !== null && offer.entry !== "offer.family-loan");
      return meeting
        ? { title: say("passbook.road.family-meeting"), line: say("passbook.road.family-meeting.line", { amount: shortNaira(road.lump) }) }
        : { title: say("passbook.road.family"), line: say("passbook.road.family.line", { amount: shortNaira(road.lump) }) };
    }
    case "scholarship":
      return { title: nameOf(road.via), line: road.state === "open" ? say("passbook.road.scholarship.line", { amount: shortNaira(road.lump) }) : say("passbook.road.scholarship.wait") };
    default: {
      const never: never = road.road;
      throw new Error(`Unknown road ${String(never)}`);
    }
  }
}

/** What a road still needs, as chips (world:one-action-one-sheet); a road waiting only on a person asking says so in its line. The tap is the road's, so nothing unfolds. */
function RoadNeeds({ view, road }: { view: PlayerView; road: PassbookRoad }) {
  if (road.needs.length === 0) return null;
  return (
    <span className="block" data-road-needs>
      <NeedChips needs={road.needs} view={view} fold={false} />
    </span>
  );
}

function RoadCard({ view, road, onTap }: { view: PlayerView; road: PassbookRoad; onTap: (road: PassbookRoad) => boolean }) {
  const [refused, setRefused] = useState(false);
  const { title, line } = roadWords(view, road);
  const months = road.state === "taken" ? null : road.months;
  return (
    <li>
      <button
        type="button"
        className={`look-card press flex w-full items-center gap-2.5 p-2.5 text-left ${refused ? "shake" : ""}`}
        onClick={() => {
          const acted = onTap(road);
          if (!acted) {
            cue("no");
            setRefused(true);
          } else cue("tap");
        }}
        onAnimationEnd={() => setRefused(false)}
        data-road={road.road}
        data-road-state={road.state}
      >
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${TINTS[ROAD_TINT[road.road]]}`}>
          <Sticker alt="" size={30} tilt={-6}>
            <Tile of={road.via} size={30} />
          </Sticker>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-tight">{title}</span>
          {line === "" ? null : <span className="block text-[13px] leading-snug text-text-2">{line}</span>}
          <RoadNeeds view={view} road={road} />
        </span>
        {road.state === "taken" ? (
          <StickerChip tint="money" tilt={2}>
            {say("passbook.road.taken")}
          </StickerChip>
        ) : months === null ? null : (
          <span data-road-months={months}>
            <StickerChip tint={road.road === view.passbook?.best ? "money" : "plain"} tilt={2}>
              {passbookCount("passbook.road.months", months)}
            </StickerChip>
          </span>
        )}
      </button>
    </li>
  );
}

/** The roads as cards, one tap each: the job board for a job, the ask's own card for an offer or a call. */
function Roads({ view, book, onAsk }: { view: PlayerView; book: PassbookView; onAsk: ReturnType<typeof useAsk>["open"] }) {
  const nav = use(PhoneNav);
  if (book.roads.length === 0) return null;
  const tap = (road: PassbookRoad): boolean => {
    if (road.state === "taken") return false;
    if (road.road === "ladder" || road.road === "side") {
      nav.openApp("jobs");
      return true;
    }
    if (road.state !== "open") return false;
    const offer = offerOf(view, road);
    if (offer !== null) {
      const choice = takeChoice(offer);
      if (choice === null) return false;
      const params = termParams(offer);
      onAsk({
        form: "card",
        icon: road.road === "family" ? "house" : "landmark",
        who: nameOf(offer.entry),
        title: say(`${offer.entry}.title`),
        line: say(`${offer.entry}.body`, params),
        cost: null,
        button: say(`${offer.entry}.choice.${choice}`),
        when: "now",
        command: { type: "offer/choose", offer: offer.id, choice },
        done: hasWords(`${offer.entry}.said.${choice}`) ? say(`${offer.entry}.said.${choice}`) : say(`${offer.entry}.choice.${choice}`),
      });
      return true;
    }
    // A road that is an act to do now: the family's call, or the family meeting.
    if (road.road !== "family") return false;
    const meeting = road.via === "activity.family-meeting";
    onAsk({
      form: "card",
      icon: "house",
      who: nameOf(road.via),
      title: say(meeting ? "passbook.road.family-meeting" : "passbook.road.family.ask"),
      line: meeting ? (hasWords(`${road.via}.blurb`) ? say(`${road.via}.blurb`) : "") : say("passbook.road.family.ask.line"),
      cost: null,
      button: say(meeting ? "passbook.road.family-meeting.go" : "passbook.road.family.call"),
      when: "now",
      command: { type: "activity/now", activity: road.via as Id<"activity">, param: null },
      done: hasWords(`line.${road.via}.now`) ? say(`line.${road.via}.now`) : nameOf(road.via),
    });
    return true;
  };
  return (
    <section data-roads>
      <Part>{say("passbook.roads")}</Part>
      <ul className="flex flex-col gap-2">
        {book.roads.map((road) => (
          <RoadCard key={road.road} view={view} road={road} onTap={tap} />
        ))}
      </ul>
    </section>
  );
}

/** The balance as a card: abroad, where the country's money stands first, and in a life that has ended. */
function BalanceCard({ view, shown, others }: { view: PlayerView; shown: Currency; others: Currency[] }) {
  return (
    <LookCard className="rise p-3" data-bank-balance={shown}>
      <div className="text-[12px] font-bold text-text-2">{say("phone.bank.balance")}</div>
      <Counter value={view.pockets[shown].bank} format={(value) => formatMoney(value, shown)} className="num block text-[26px] font-bold leading-tight" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StickerChip tilt={-1.5}>{say("phone.bank.cash", { amount: formatMoney(view.pockets[shown].cash, shown) })}</StickerChip>
        <AlsoHeld view={view} others={others} />
      </div>
    </LookCard>
  );
}

/** Changes the bank makes later, while they are on their way: what was paid, into what, and when it is ready, as months away. */
function OnTheWay({ view }: { view: PlayerView }) {
  if (view.queued.length === 0) return null;
  return (
    <LookCard className="p-3" data-bank-queued>
      <Part>{say("ui.wallet.queued")}</Part>
      <div className="flex flex-wrap gap-1.5">
        {view.queued.map((item, index) => (
          <StickerChip key={item.id} tint="study" tilt={index % 2 === 0 ? -1.5 : 1.5}>
            {say("phone.bank.queued.item", { paid: formatMoney(item.paid, item.from), to: say(`ui.currency.${item.to}`), when: inMonths(item.readyMonth, view.month) })}
          </StickerChip>
        ))}
      </div>
    </LookCard>
  );
}

/** Abroad, the family at home (abroad-money:remit-sends-money-home, abroad-money:family-asks-more-abroad): the naira at home that their requests are paid from, and what goes home each month. */
function FamilyCard({ view }: { view: PlayerView }) {
  const naira = view.pockets.NGN;
  const support = view.obligations.filter((owed) => content.obligation[owed.entry]?.type === "support");
  return (
    <LookCard className="flex items-start gap-3 p-3" data-family>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-tint-people">
        <Sticker emoji="🏠" alt="" size={30} tilt={-5} />
      </span>
      <div className="min-w-0">
        <Part>{say("ui.family.title")}</Part>
        <p className="num text-[15px] font-bold">{say("ui.family.naira", { bank: formatMoney(naira.bank, "NGN"), cash: formatMoney(naira.cash, "NGN") })}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-text-2">{say("ui.family.why")}</p>
        {support.length === 0 ? null : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {support.map((owed) => (
              <StickerChip key={owed.id} tint="people" tilt={-1.5}>
                {say("ui.family.support", { name: nameOf(owed.entry), amount: formatMoney(owed.due, content.obligation[owed.entry]?.currency ?? "NGN") })}
              </StickerChip>
            ))}
          </div>
        )}
      </div>
    </LookCard>
  );
}

/** The highest credit mark and the step the file is read in (credit:view-shows-credit-file: what the next ten points buy). */
const MARK_MAX = 100;
const MARK_STEP = 10;

/**
 * The credit file abroad (credit:view-shows-credit-file): the mark as a bar with every entry that needs credit marked on it, the
 * counts, a judgment and when it clears (credit:judgment-blocks-credit), what is open now, what the next ten points buy and what is further off.
 */
function CreditCard({ view, file }: { view: PlayerView; file: NonNullable<PlayerView["credit"]> }) {
  const capped = file.judgmentUntil !== null;
  const cap = content.tuning.credit.judgmentCap;
  // A judgment keeps every need above the cap out of reach (credit:judgment-blocks-credit).
  const reachable = (min: number) => !capped || min <= cap;
  const open = file.needs.filter((need) => need.creditMin <= file.mark && reachable(need.creditMin));
  const next = file.needs.filter((need) => need.creditMin > file.mark && need.creditMin <= file.mark + MARK_STEP && reachable(need.creditMin));
  const later = file.needs.filter((need) => need.creditMin > file.mark + MARK_STEP || !reachable(need.creditMin));
  return (
    <LookCard className="p-3" data-credit>
      <Part>{say("ui.credit.title")}</Part>
      <p className="flex items-baseline gap-1.5">
        <span className="num text-[26px] leading-tight font-bold">{file.mark}</span>
        <span className="text-[14px] text-text-2">{say("ui.credit.of", { max: MARK_MAX })}</span>
      </p>
      <div role="meter" aria-label={say("ui.credit.mark", { mark: file.mark })} aria-valuemin={0} aria-valuemax={MARK_MAX} aria-valuenow={file.mark} className="relative mt-2 mb-1 h-3.5 rounded-[5px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--sheet-line)]">
        <div className="h-full rounded-[5px] bg-[var(--tick)]" style={{ width: `${String(Math.min(MARK_MAX, file.mark))}%` }} />
        {file.needs.map((need) => (
          <span key={need.id} aria-hidden="true" className={`absolute -top-1 h-5.5 w-0.5 rounded-[1px] ${need.creditMin <= file.mark ? "bg-[var(--money-ink)]" : "bg-text"}`} style={{ left: `${String(need.creditMin)}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StickerChip tint="money" tilt={-1.5}>{sayCount("ui.credit.on-time", file.onTime, { count: file.onTime })}</StickerChip>
        <StickerChip tilt={1.5}>{sayCount("ui.credit.missed", file.missed, { count: file.missed })}</StickerChip>
      </div>
      {capped ? (
        <p className="mt-2 text-[14px] leading-snug font-bold text-out" data-credit-judgment>
          {say("phone.bank.credit.judgment", { when: inMonths(file.judgmentUntil ?? 0, view.month), cap: String(cap) })}
        </p>
      ) : null}
      <div className="mt-2.5" data-next-ten>
        <p className="text-[14px] font-bold">{say("ui.credit.next-ten", { mark: Math.min(MARK_MAX, file.mark + MARK_STEP) })}</p>
        {next.length === 0 ? (
          <p className="text-[14px] text-text-2">{say("ui.credit.next-none")}</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {next.map((need, index) => (
              <StickerChip key={need.id} tint="study" tilt={index % 2 === 0 ? -1.5 : 1.5}>
                {say("ui.credit.need", { name: nameOf(need.id), min: need.creditMin })}
              </StickerChip>
            ))}
          </div>
        )}
      </div>
      {/* text:show-then-tell: what is open now a tick each, what is further off a clock each with the mark it opens at. */}
      {open.length + later.length === 0 ? null : (
        <div className="mt-2.5 flex flex-wrap gap-1.5" data-credit-reach>
          {open.map((need) => (
            <StateTag key={need.id} state="done" id={`open-${need.id}`} wrap>
              {nameOf(need.id)}
            </StateTag>
          ))}
          {later.map((need) => (
            <StateTag key={need.id} state="waiting" id={`later-${need.id}`} wrap>
              {say("ui.credit.need", { name: nameOf(need.id), min: need.creditMin })}
            </StateTag>
          ))}
        </div>
      )}
    </LookCard>
  );
}

/** A foot act: white with the navy edge and its underside, navy when its chooser is open. */
function footButton(open: boolean): string {
  return `press flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[14px] border-2 border-edge px-3 text-[15px] font-bold whitespace-nowrap shadow-[0_3px_0_var(--edge)] ${open ? "bg-[var(--strong)] text-on-strong" : "bg-sheet-2 text-text"}`;
}

/** `opening`: a chooser to open on, as the room's phone opens Send money home. */
export function Bank({ opening: openOn = null }: { opening?: "change" | "move" | "send" | null } = {}) {
  const view = useView();
  const { open, sheet } = useAsk();
  const [choosing, setChoosing] = useState<"change" | "move" | "send" | null>(openOn);
  const [start, setStart] = useState<ChangeStart | undefined>(undefined);
  // The money the character lives on: the naira at home, the country's own abroad (world:top-band-is-a-pill).
  const local = localCurrency(view);
  const abroad = local !== "NGN";
  // Once flown, the move is made and has no target. The figure is the results' own, from the month the plan is set (its
  // lean, as the chapters follow it); before it, one line says there is no plan yet.
  const savings = abroad || view.plan.route === null ? null : savingsOf(view);
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

  // What a choice opens settles in where it was tapped, and comes into view over the foot (world:motions-under-half-second).
  const chooser = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (choosing !== null && typeof chooser.current?.scrollIntoView === "function") chooser.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [choosing]);
  const book = abroad ? null : view.passbook;

  return (
    <div data-phone-app="bank" className="flex flex-col gap-3">
      {abroad && !view.ended ? <DuesGapCard onChange={changeFrom} /> : null}
      {book === null ? <BalanceCard view={view} shown={local} others={abroad ? [] : others} /> : <PassbookCard view={view} book={book} shown={local} others={others} />}
      {abroad && !view.ended ? <HeldElsewhere local={local} onChange={changeFrom} /> : null}
      {abroad ? <FamilyCard view={view} /> : null}
      {view.credit === null ? null : <CreditCard view={view} file={view.credit} />}
      {book === null ? null : (
        <>
          <Stamps book={book} />
          <LastMonth view={view} lastMonth={lastMonth} />
          {view.ended ? null : <Roads view={view} book={book} onAsk={open} />}
        </>
      )}

      {abroad ? null : (
        <LookCard className="p-3" data-bank-saved>
          <Part>{say("phone.bank.savings")}</Part>
          {savings === null ? (
            <p className="text-[14px] text-text-2" data-savings-none>
              {say(noFigureKey(view))}
            </p>
          ) : (
            <div data-savings>
              <div className="h-2.5 overflow-hidden rounded-[4px] bg-sheet shadow-[inset_0_0_0_1.5px_var(--sheet-line)]" role="progressbar" aria-valuemin={0} aria-valuemax={savings.required} aria-valuenow={Math.min(savings.shown, savings.required)} aria-label={say("phone.bank.savings")}>
                <div className="h-full rounded-[4px] bg-[var(--tick)]" style={{ width: `${String(Math.min(100, Math.floor((savings.shown * 100) / savings.required)))}%` }} />
              </div>
              <p className="num mt-1.5 text-[15px]" data-savings-met={savings.shown >= savings.required ? "true" : undefined}>
                {say(savingsKey(view, savings), { shown: formatMoney(savings.shown, savings.currency), required: formatMoney(savings.required, savings.currency) })}
              </p>
            </div>
          )}
        </LookCard>
      )}

      <OnTheWay view={view} />

      <LookCard className="p-3" data-bank-lately>
        <Part>{say("phone.bank.lines")}</Part>
        {lately.length === 0 ? (
          <p className="text-[14px] text-text-2">{say("phone.bank.lines.none")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-sheet-line" data-money-lines>
            {lately.map(({ line, sign }, index) => (
              <li key={`${line.key}-${String(index)}`} className={`py-1.5 text-[14px] ${sign > 0 ? "text-[var(--money-ink)]" : "text-text"}`} data-sign={sign}>
                {words(line.key, line.params)}
              </li>
            ))}
          </ul>
        )}
      </LookCard>

      {view.ended || choosing === null ? null : (
        <div key={choosing} ref={chooser} className="motion-reveal">
          {choosing === "change" ? <ChangeChooser key={start === undefined ? "free" : `${start.from}-${start.to}`} onAsk={open} {...(start === undefined ? {} : { start })} /> : choosing === "move" ? <MoveChooser onAsk={open} /> : <SendChooser onAsk={open} />}
        </div>
      )}

      {view.ended ? null : (
        // The acts stand at the foot of the screen, over the page as it scrolls. While a chooser
        // is open the foot comes after it instead, so its last way (Through someone) is never under the foot's buttons;
        // the chooser's own button does the act, the foot only opens and closes.
        <div className={`${choosing === null ? "sticky -bottom-3" : ""} -mx-3 -mb-3 border-t border-sheet-line bg-sheet px-3 pt-3 pb-3`} data-bank-foot>
          <div className="flex gap-2">
            {/* Abroad with other monies held, Change money heads their pairs above; it is not said again here. */}
            {pairsShown ? null : (
              <button type="button" className={footButton(choosing === "change")} aria-expanded={choosing === "change"} onClick={() => toggle("change")}>
                <ArrowLeftRight size={17} aria-hidden />
                {say("ui.wallet.convert")}
              </button>
            )}
            <button type="button" className={footButton(choosing === "move")} aria-expanded={choosing === "move"} onClick={() => toggle("move")}>
              <MoveVertical size={17} aria-hidden />
              {say("ui.wallet.move")}
            </button>
          </div>
          {abroad ? (
            <button type="button" className={`${footButton(choosing === "send")} mt-2 w-full`} aria-expanded={choosing === "send"} onClick={() => toggle("send")} data-bank-act="send">
              <Send size={17} aria-hidden />
              {say("ui.remit.title")}
            </button>
          ) : null}
        </div>
      )}
      {sheet}
    </div>
  );
}
