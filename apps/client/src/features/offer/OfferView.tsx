// Open offers: requests, jobs, loans and men who can arrange things. The
// title, body, signs and choices are content's words; the terms fill the braces.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { int, type Amount, type Currency, type Effect, type OfferView as Offer, type ReportLine, type Terms } from "@japacity/sim";
import { Eye, X } from "lucide-react";
import { useId, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Empty } from "../../shared/ui/Panel";
import { Face, faceMark } from "../../shared/ui/look/Face";
import { StickerChip } from "../../shared/ui/look/StickerChip";
import { afterPaying, monthDues, plannedCosts } from "../../shared/words/cost";
import { ReportLines } from "../../shared/ui/ReportLines";
import { askerOf, mayBeScam } from "../../shared/words/asks";
import { isSaid, tidyLines } from "../../shared/words/lines";
import { formatMoney, toMajor, toMinor } from "../../shared/words/format";
import { routeKeptBy } from "../../shared/words/keepJob";
import { byMonths, hasWords, nameOf, say, sayCount, words } from "../../shared/words/text";
import { payAMonth } from "../../shared/words/pay";
import { choiceCurrency, offerParams } from "./terms";

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

/** The slots a choice holds, from its own `turn/lock` effects, said before it is taken (health:view-shows-health-warning). */
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
  const view = useView();
  const pay = payAMonth(job);
  const amount = pay === null ? null : formatMoney(pay.amount, pay.currency);
  const kept = routeKeptBy(view);
  return (
    <>
      {/* activity:catch-drawn-each-month: a boat rung's pay is its base, which the catch scales. */}
      <p className="font-semibold">{amount === null ? nameOf(job) : say(content.activity[job as Id<"activity">]?.catch === true ? "ui.offer.job.catch" : "ui.offer.job", { job: nameOf(job), amount })}</p>
      {/* A way out that counts the months in the job held: the offer says what taking another ends. */}
      {/* A side job sits beside the day job and ends nothing. */}
      {kept === null || job === view.job.id || content.activity[job as Id<"activity">]?.slot === "side" ? null : <p className="text-sm text-out" data-offer-job-ends>{say("ui.offer.job-ends")}</p>}
    </>
  );
}

/** Whole naira steps for the picker; the engine takes kobo. */
const STEP_MAJOR = 1000;

function AmountPicker({ min, max, value, currency, onChange }: { min: number; max: number; value: number; currency: Currency; onChange: (value: number) => void }) {
  const id = useId();
  const minMajor = Math.ceil(toMajor(min));
  const maxMajor = Math.floor(toMajor(max));
  const set = (major: number) => onChange(toMinor(Math.min(maxMajor, Math.max(minMajor, Math.round(major)))));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {say("ui.offer.amount")}: <span className="font-semibold">{formatMoney(value, currency)}</span>
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
        className="min-h-11 rounded-md border border-sheet-line bg-sheet px-3 tabular-nums"
      />
      <p id={`${id}-bounds`} className="text-xs text-text-2">
        {say("ui.offer.bounds", { min: formatMoney(min, currency), max: formatMoney(max, currency) })}
      </p>
    </div>
  );
}

/**
 * route:education-loan-pays-the-school: for the amount picked, what the lender pays the university and what is owed with its fee added, and
 * that nothing is charged until the course is over, then over the loan's years. Shown for a choice that pays a route's school by a loan.
 */
function LoanFigures({ offer, choice, amount }: { offer: Offer; choice: string; amount: number }) {
  const effects = content.offer[offer.entry]?.choices.find((each) => each.id === choice)?.effects ?? [];
  if (!effects.some((effect) => effect.type === "route/loan")) return null;
  const opened = effects.find((effect) => effect.type === "obligation/open");
  if (opened?.type !== "obligation/open") return null;
  const loan = content.obligation[opened.obligation];
  if (loan === undefined) return null;
  const principal = opened.principal;
  const share = typeof principal === "object" && principal !== null && "bp" in principal && typeof principal.bp === "number" ? principal.bp : 10_000;
  const owed = int.mulDiv(amount, share, 10_000);
  const years = loan.term === null ? 0 : Math.floor(loan.term / 12);
  return (
    <div className="flex flex-col gap-1 text-[15px] leading-snug" data-loan>
      <p className="font-semibold">{say("ui.offer.loan.pays", { amount: formatMoney(amount, loan.currency), owed: formatMoney(owed, loan.currency) })}</p>
      <p className="text-text-2" data-loan-starts>
        {say("ui.offer.loan.starts", { years })}
      </p>
    </div>
  );
}

/**
 * The answers in the order the card shows them: as content gives them, or for an ask that may be a scam (`mayBeScam`) the
 * free ones first. Such an ask has no main button: every answer is plain, so the player reads before choosing, the way to
 * say no before the way to pay (advice:scams-show-their-tells, world:one-action-one-sheet): a quick hand never pays a deposit
 * from a yellow button.
 */
function shownChoices(offer: Offer): Offer["choices"] {
  if (!mayBeScam(offer)) return offer.choices;
  const pays = (choice: Offer["choices"][number]): number => (choice.pick === null && choiceCost(offer, choice.id) === null ? 0 : 1);
  return [...offer.choices].sort((a, b) => pays(a) - pays(b));
}

/** The picture in the corner of the asker's mark, by the offer's group, since the asks have no tiles of their own. */
const ASK_PICTURE: Readonly<Record<string, string>> = { family: "💡", job: "💼", money: "💸", life: "📱", road: "🧳", abroad: "✈️", return: "🏠" };

// The asker's name lives in shared words, so the results' faces name the same person the card does.
export { askerOf } from "../../shared/words/asks";

/** The ask's title: content's, in the asker's voice; content shortens each to a few words. */
function askTitle(offer: Offer): string {
  return words(`${offer.entry}.title`, offerParams(offer));
}

/** A choice's price, summed, when it is one money: for the price pill and the balance under it. */
function choiceMoney(offer: Offer, choice: string): { currency: Currency; amount: number } | null {
  const effects: Effect[] = content.offer[offer.entry]?.choices.find((entry) => entry.id === choice)?.effects ?? [];
  let currency: Currency | null = null;
  let amount = 0;
  for (const effect of effects) {
    if (effect.type !== "money/take" && effect.type !== "money/pay-fee") continue;
    const figure_ = figure(effect.amount, offer.terms);
    if (figure_ === null) continue;
    if (currency !== null && currency !== effect.currency) return null;
    currency = effect.currency;
    amount += figure_;
  }
  return currency === null ? null : { currency, amount };
}

/**
 * One reply as a row: its words, then the balance before struck and after and
 * the price as a yellow pill, or "Free" alone when it costs nothing, never beside a "No cost" that says the same
 * (docs/design/09-the-games-look.md section 2). Its name is the reply with its cost, so it never hides its price.
 */
function ReplyRow({ offer, choice, disabled, main, freeShown, onPick }: { offer: Offer; choice: Offer["choices"][number]; disabled: boolean; main: boolean; freeShown: boolean; onPick: () => void }) {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const money = choice.pick === null ? choiceMoney(offer, choice.id) : null;
  const paying = money === null || money.amount === 0 ? null : afterPaying(view, plannedCosts(view, plan), [money], monthDues(view));
  const label = words(`${offer.entry}.choice.${choice.id}`, offerParams(offer));
  return (
    <button
      type="button"
      className={`ask-reply press flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-50 ${main ? "ask-reply-main" : ""}`}
      disabled={disabled}
      onClick={onPick}
      aria-label={choiceLabel(offer, choice)}
      data-reply={choice.id}
      {...(main ? { "data-reply-main": "" } : {})}
    >
      <span className="min-w-0 flex-1 text-[17px] leading-tight font-bold" data-reply-label>
        {label}
      </span>
      {money === null || money.amount === 0 ? (
        freeShown && choice.pick === null && choiceLock(offer, choice.id) === null ? (
          <span className="ask-price shrink-0" data-reply-free>
            {say("ui.world.free")}
          </span>
        ) : null
      ) : (
        <>
          {paying === null || paying.short !== null ? (
            paying?.short === null || paying === null ? null : (
              <span className="shrink-0 text-[13px] font-bold text-out">{say("ui.world.short", { amount: formatMoney(paying.short.amount, paying.short.currency) })}</span>
            )
          ) : (
            <span className="num flex shrink-0 flex-col items-end text-[13px] leading-tight" data-reply-balance>
              <s className="text-text-2">{formatMoney(paying.before.amount, paying.before.currency)}</s>
              <b>{formatMoney(paying.left.amount, paying.left.currency)}</b>
            </span>
          )}
          <span className="ask-price num shrink-0" data-reply-price>
            {formatMoney(money.amount, money.currency)}
          </span>
        </>
      )}
    </button>
  );
}

function OfferCard({ offer, onChosen }: { offer: Offer; onChosen: (lines: ReportLine[]) => void }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const { ended, month } = useView();
  const picking = offer.choices.find((choice) => choice.pick !== null);
  const [amount, setAmount] = useState<number>(picking?.pick?.min ?? 0);
  // An amount is picked in the money its choice pays or owes in: the study lender's pounds, the show-money's naira.
  const pickCurrency = (picking === undefined ? null : choiceCurrency(content.offer[offer.entry]?.choices.find((choice) => choice.id === picking.id)?.effects ?? [])) ?? "NGN";
  const params = offerParams(offer);
  const asker = askerOf(offer);
  const mark = faceMark(asker);
  const group = content.offer[offer.entry]?.group ?? "life";
  const scam = mayBeScam(offer);
  // advice:scams-show-their-tells: one sign shows at once; the rest are found by looking, which is free and finds every one.
  const [looked, setLooked] = useState(false);
  const signsShown = looked ? offer.signs : offer.signs.slice(0, 1);
  const signsHidden = offer.signs.length - signsShown.length;

  return (
    <li className="flex flex-col gap-3" data-ask={offer.entry}>
      {/* The asker: a large flat mark with a picture of what it is about, their name pill, the title in their voice. */}
      <div className="flex items-center gap-3">
        <span className="ask-mark relative flex size-[76px] shrink-0 items-center justify-center text-[34px] font-bold text-white" style={{ background: scam ? "#6b7a90" : mark.colour }} aria-hidden>
          {scam ? "?" : mark.initial}
          <span className="sticker-cut absolute -right-2 -bottom-1 text-[24px]" style={{ rotate: "8deg" }}>
            {ASK_PICTURE[group] ?? "📱"}
          </span>
        </span>
        <div className="min-w-0">
          <Face name={asker} />
          <h3 className="mt-1 text-[22px] leading-tight font-bold" data-ask-title>
            {askTitle(offer)}
          </h3>
        </div>
      </div>
      <JobFigures terms={offer.terms} />
      <p className="text-[16px] leading-snug">{words(`${offer.entry}.body`, params)}</p>
      <div className="flex flex-wrap gap-2">
        <StickerChip tilt={-2} className="bg-sheet-2">
          {say("ui.offer.expires", { when: byMonths(offer.expiresMonth, month) })}
        </StickerChip>
        {offer.signs.length === 0 ? (
          <StickerChip tilt={2} tint={group === "family" || group === "return" ? "people" : group === "money" || group === "job" ? "money" : "plain"}>
            {say(`ui.ask.group.${group}`)}
          </StickerChip>
        ) : (
          <>
            {signsShown.map((sign, index) => (
              <span key={sign} className="sticker-chip bg-[var(--soft)]" style={{ rotate: `${String(index % 2 === 0 ? 2 : -1)}deg`, color: "var(--soft-ink)" }} data-ask-sign={sign}>
                <span aria-hidden>👀</span>
                {words(`${offer.entry}.sign.${sign}`, params)}
              </span>
            ))}
            {signsHidden === 0 ? null : (
              <button type="button" className="sticker-chip press bg-tint-plain font-bold" style={{ rotate: "-1deg" }} onClick={() => setLooked(true)} data-ask-look>
                <Eye size={16} aria-hidden />
                {say("ui.offer.look")}
              </button>
            )}
          </>
        )}
      </div>
      {picking === undefined || picking.pick === null ? null : (
        <>
          <AmountPicker min={picking.pick.min} max={picking.pick.max} value={amount} currency={pickCurrency} onChange={setAmount} />
          <LoanFigures offer={offer} choice={picking.id} amount={amount} />
        </>
      )}
      <div className="flex flex-col gap-2.5">
        {shownChoices(offer).map((choice, index) => (
          <ReplyRow
            key={choice.id}
            offer={offer}
            choice={choice}
            // An honest ask keeps its main answer, the first; an ask that may be a scam has none (advice:scams-show-their-tells).
            main={index === 0 && !scam}
            // "Free" only where another answer has a price, so it says something (docs/design/09-the-games-look.md section 2).
            freeShown={offer.choices.some((other) => other.pick !== null || (choiceMoney(offer, other.id)?.amount ?? 0) > 0)}
            disabled={!choice.allowed || busy || ended}
            onPick={() =>
              void send(
                choice.pick === null
                  ? { type: "offer/choose", offer: offer.id, choice: choice.id }
                  : { type: "offer/choose", offer: offer.id, choice: choice.id, amount },
              ).then((reply) => {
                if (reply?.ok === true) onChosen(reply.lines);
              })
            }
          />
        ))}
      </div>
      {/* A shut answer says why, where content gives the reason (the taken-in friend, home:taken-in-after-eviction). */}
      {offer.choices
        .filter((choice) => !choice.allowed && hasWords(`${offer.entry}.choice.${choice.id}.shut`))
        .map((choice) => (
          <p key={choice.id} className="text-sm text-text-2" data-choice-shut={choice.id}>
            {words(`${offer.entry}.choice.${choice.id}.shut`, params)}
          </p>
        ))}
    </li>
  );
}

/** What the last choice moved, so a choice is never silent. */
function Outcome({ lines, onClose }: { lines: ReportLine[]; onClose: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md border border-sheet-line bg-sheet-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{say("ui.offer.outcome")}</h3>
        <button type="button" aria-label={say("ui.dismiss")} className="reach inline-flex size-9 items-center justify-center rounded-md hover:bg-sheet-muted" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {lines.length === 0 ? <p className="text-sm text-text-2">{say("ui.offer.outcome-none")}</p> : <ReportLines lines={[...tidyLines(lines)].sort((a, b) => Number(isSaid(b)) - Number(isSaid(a)))} />}
    </div>
  );
}

/** `only` keeps the offers a screen shows; the road shows its own and nothing from home (road:road-earns-nothing). */
export function OfferView({ only }: { only?: (offer: Offer) => boolean } = {}) {
  const view = useView();
  const offers = only === undefined ? view.offers : view.offers.filter(only);
  const [outcome, setOutcome] = useState<ReportLine[] | null>(null);
  return (
    // The asks as the game's look draws them: no tracked heading over the card, the sheet names what it holds.
    <section aria-label={say("ui.offer.title")} className="flex flex-col gap-3">
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
    </section>
  );
}
