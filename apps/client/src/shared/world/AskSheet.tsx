// One action, one sheet (docs/rules/world.md R-WORLD-006). A priced act's button says the act and its price, and under
// it the balance before stands struck beside the balance after (decision 0035). A main button the player cannot pay for
// is shut and says how much is short, as the ride sheet does, so nothing is planned or sent that cannot be paid.
import { Dialog } from "@base-ui/react/dialog";
import type { Currency } from "@japacity/sim";
import { TriangleAlert, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { useGame, useGameStoreIfAny } from "../../authority/GameProvider";
import { StickerChip } from "../ui/lively/StickerChip";
import { afterHaving, afterPaying, monthDues, plannedCosts, type AfterPaying, type Money } from "../words/cost";
import { say } from "../words/text";
import { Balance, CENTRED, pricedLabel } from "./Balance";
import type { Ask } from "./contract";

export interface AskSheetProps {
  ask: Ask | null;
  /**
   * The money the cost is paid from now, in its currency, when the caller has counted it itself
   * (a bill paid now, held funds returned). Left out inside a game, the sheet counts the naira bank
   * and cash less what the month's plan already pays for, as the month's end will.
   */
  from?: number;
  /** The money in the cost's currency, for a sheet shown with no game around it. Inside a game the sheet counts for itself. */
  have?: number;
  formatMoney: (amount: number, currency: string) => string;
  /** The icon for the card's corner, by the ask's icon name. */
  icon?: (name: string) => ReactNode;
}

/** The main button's second line, the figure alone for a slip, whether it is shut, whether the line warns, and the balance. */
interface Main {
  after: string | null;
  figure: string | null;
  shut: boolean;
  /** True when the month's dues are more than what is left after: the button stays open, the line warns. */
  warn?: boolean;
  /** The balance before the act and after it, shown under the button; none when short or when no pocket pays. */
  balance?: { before: Money; after: Money };
}

/**
 * The button's money: how much is short, the one exception everywhere; for a priced act the balance before and after
 * under the button (R-WORLD-006, decision 0035), with the month's dues as its warning; for any other ask (a change of
 * money, a bill from the phone) what is left after on the button's second line, as before.
 */
function mainOf(paying: AfterPaying | null, formatMoney: AskSheetProps["formatMoney"], priced: boolean): Main {
  if (paying === null) return { after: null, figure: null, shut: false };
  if (paying.short !== null) {
    const amount = formatMoney(paying.short.amount, paying.short.currency);
    return { after: say("ui.world.short", { amount }), figure: amount, shut: true };
  }
  const left = formatMoney(paying.left.amount, paying.left.currency);
  const due = paying.due === null ? null : formatMoney(paying.due.amount, paying.due.currency);
  if (priced) {
    const balance = { before: paying.before, after: paying.left };
    if (due === null) return { after: null, figure: null, shut: false, balance };
    const after = say("ui.world.due", { due });
    return { after, figure: after, shut: false, warn: true, balance };
  }
  if (due !== null) {
    const after = say("ui.world.left-due", { left, due });
    return { after, figure: after, shut: false, warn: true };
  }
  return { after: say("ui.world.left", { amount: left }), figure: null, shut: false };
}

/** The balance under a priced act's button, in the words of its money. */
function BalanceOf({ balance, formatMoney, className }: { balance: NonNullable<Main["balance"]>; formatMoney: AskSheetProps["formatMoney"]; className?: string }) {
  return (
    <Balance
      before={{ amount: balance.before.amount, words: formatMoney(balance.before.amount, balance.before.currency) }}
      after={{ amount: balance.after.amount, words: formatMoney(balance.after.amount, balance.after.currency) }}
      {...(className === undefined ? {} : { className })}
    />
  );
}

/** The main button's words: the act and its price when the pockets pay for it (R-WORLD-006), else the act alone. */
function labelOf(ask: Ask, main: Main, formatMoney: AskSheetProps["formatMoney"]): string {
  const priced = ask.priced === true && ask.cost !== null && ask.blocked === undefined && ask.note === undefined;
  return priced && ask.cost !== null ? pricedLabel(ask.button, formatMoney(ask.cost.amount, ask.cost.currency)) : ask.button;
}

export function AskSheet(props: AskSheetProps) {
  const store = useGameStoreIfAny();
  if (store === null || props.from !== undefined) {
    const { ask, from, have = 0 } = props;
    const paying = ask === null || ask.cost === null ? null : afterHaving(from ?? have, { currency: ask.cost.currency as Currency, amount: ask.cost.amount });
    return <Sheet {...props} main={mainOf(paying, props.formatMoney, ask?.priced === true)} />;
  }
  return <GameSheet {...props} />;
}

/** Inside a game: what is left after counts the pockets and the month's plan, against the month's dues (R-WORLD-006). */
function GameSheet(props: AskSheetProps) {
  const view = useGame((state) => state.view);
  const plan = useGame((state) => state.plan);
  const cost = props.ask?.cost ?? null;
  const paying = cost === null || view === null ? null : afterPaying(view, plannedCosts(view, plan), [{ currency: cost.currency as Currency, amount: cost.amount }], monthDues(view));
  return <Sheet {...props} main={mainOf(paying, props.formatMoney, props.ask?.priced === true)} />;
}

function Sheet({ ask, formatMoney, icon, main: counted }: AskSheetProps & { main: Main }) {
  const open = ask !== null;
  // A reason from the world shuts the button and takes the second line (R-WORLD-006).
  const main: Main = ask?.blocked !== undefined ? { after: ask.blocked, figure: null, shut: true } : ask?.note !== undefined ? { after: ask.note, figure: null, shut: false } : counted;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) ask?.dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-scrim fixed inset-0 z-40 bg-scrim/60 data-closed:pointer-events-none data-ending-style:pointer-events-none" />
        <Dialog.Popup className="motion-sink fixed inset-x-0 bottom-0 z-50 outline-hidden data-closed:pointer-events-none data-ending-style:pointer-events-none" data-ask-form={ask?.form}>
          {ask === null ? null : ask.form === "card" ? <Card ask={ask} main={main} formatMoney={formatMoney} icon={icon} /> : <Slip ask={ask} main={main} formatMoney={formatMoney} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Card({ ask, main, formatMoney, icon }: { ask: Ask; main: Main; formatMoney: AskSheetProps["formatMoney"]; icon: AskSheetProps["icon"] }) {
  return (
    // The lively card (docs/design/13-the-lively-layer.md section 2): the sheet's pale sky with its handle, the picture on a
    // soft tile, a small line for who and where, the title of a few words; navy at night.
    <div className="rise mx-auto w-full max-w-[430px] overflow-hidden rounded-t-[26px] bg-sheet text-text shadow-[0_-10px_30px_rgba(0,0,0,0.22)]" data-lively-frame>
      <span aria-hidden className="mx-auto mt-2 block h-[5px] w-10 rounded-[3px] bg-text/25" />
      <div className="relative flex items-center gap-3 px-4 pt-2 pr-12 pb-1">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-tint-plain text-text">{icon?.(ask.icon)}</div>
        <div className="min-w-0 flex-1">
          <Dialog.Description className="truncate text-[13px] font-medium text-text-2">{ask.who}</Dialog.Description>
          <Dialog.Title className="text-title leading-tight font-bold">{ask.title}</Dialog.Title>
        </div>
        <Dialog.Close aria-label={say("ui.world.close")} className="press absolute top-1 right-3 flex size-9 items-center justify-center rounded-[12px] text-text-2">
          <X size={18} />
        </Dialog.Close>
      </div>
      <div className="p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <p className="text-[15px] leading-snug text-text-2">{ask.line}</p>
        {/* What the act means, as sticker chips under the line (the bag's Go home: what ends, what waits). */}
        {ask.facts === undefined || ask.facts.length === 0 ? null : (
          <div className="mt-3 flex flex-wrap gap-2" data-ask-facts>
            {ask.facts.map((fact, index) => (
              <StickerChip key={fact} tilt={index % 2 === 0 ? -2 : 2}>
                {fact}
              </StickerChip>
            ))}
          </div>
        )}
        {/* R-ACTIVITY-018: an act done at once says the time it takes in words, beside its price. */}
        {ask.time === undefined ? null : (
          <div className="mt-3 flex items-baseline justify-between border-t border-sheet-line pt-2.5" data-ask-time>
            <span className="text-[14px] font-semibold">{say("ui.world.takes")}</span>
            <span className="text-[16px] font-bold">{ask.time}</span>
          </div>
        )}
        {ask.does === undefined ? null : (
          <div className={`flex items-baseline justify-between gap-3 ${ask.time === undefined ? "mt-3 border-t border-sheet-line pt-2.5" : "mt-1"}`} data-ask-does>
            <span className="shrink-0 text-[14px] font-semibold">{say("ui.world.does")}</span>
            <span className="truncate text-[15px] font-bold">{ask.does}</span>
          </div>
        )}
        {/* The price stands on the button when the pockets pay for it; otherwise it has its own row. */}
        {ask.cost === null || labelOf(ask, main, formatMoney) !== ask.button ? null : (
          <div className="mt-3 flex items-baseline justify-between border-y border-sheet-line py-2.5">
            <span className="text-[14px] font-semibold">{say("ui.world.costs")}</span>
            <span className="num text-[26px]">{formatMoney(ask.cost.amount, ask.cost.currency)}</span>
          </div>
        )}
        {ask.spent === undefined ? (
          <>
            <MainButton ask={ask} main={main} label={labelOf(ask, main, formatMoney)} />
            {main.balance === undefined ? null : <BalanceOf balance={main.balance} formatMoney={formatMoney} className="mt-2.5 justify-center" />}
          </>
        ) : (
          <p className="mt-4 rounded-[6px] bg-sheet-muted px-4 py-3.5 text-center text-[15px] font-bold" data-ask-spent>
            {ask.spent}
          </p>
        )}
      </div>
    </div>
  );
}

/** The label and its second line side by side, apart. */
const SPREAD: CSSProperties = { justifyContent: "space-between" };

/** Label and second line together longer than this stack, so neither wraps out of the button at 390 px. */
const SIDE_BY_SIDE = 34;


/** The button's own shape stacked: the label over its second line, as tall as the two need. */
const STACKED: CSSProperties = { height: "auto", minHeight: 58, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, paddingTop: 10, paddingBottom: 12, textAlign: "left" };

/**
 * The card's one main button: the act's name and its second line side by side, or stacked when
 * they are long ("Board the plane" with a reason from the world). A line
 * that warns of the month's dues keeps the button open and carries a warning mark.
 */
function MainButton({ ask, main, label }: { ask: Ask; main: Main; label: string }) {
  // A priced act done at once needs no second line: the balance under the button says what is left (R-WORLD-006).
  const second = main.after ?? (main.balance !== undefined && ask.when === "now" ? null : say(ask.when === "now" ? "ui.world.now" : "ui.world.counts-at-end"));
  const stacked = second !== null && label.length + second.length > SIDE_BY_SIDE;
  return (
    <button type="button" className="press-button mt-4 w-full" style={stacked ? STACKED : second === null ? CENTRED : SPREAD} onClick={ask.act} disabled={main.shut} data-ask-main data-short={main.shut ? "true" : undefined} data-ask-stacked={stacked ? "true" : undefined}>
      <span className="leading-tight">{label}</span>
      {second === null ? null : main.warn === true ? (
        <span className="flex items-center gap-1 text-[13px] leading-snug font-bold" data-ask-warn>
          <TriangleAlert size={14} aria-hidden className="shrink-0" />
          {second}
        </span>
      ) : (
        <span className="text-[13px] leading-snug font-semibold opacity-80">{second}</span>
      )}
    </button>
  );
}

const TORN = "polygon(0 8px, 4% 0, 8% 8px, 12% 0, 16% 8px, 20% 0, 24% 8px, 28% 0, 32% 8px, 36% 0, 40% 8px, 44% 0, 48% 8px, 52% 0, 56% 8px, 60% 0, 64% 8px, 68% 0, 72% 8px, 76% 0, 80% 8px, 84% 0, 88% 8px, 92% 0, 96% 8px, 100% 0, 100% 100%, 0 100%)";

function Slip({ ask, main, formatMoney }: { ask: Ask; main: Main; formatMoney: AskSheetProps["formatMoney"] }) {
  return (
    <div className="rise mx-auto w-[88%] max-w-[360px]">
      <div className="px-5 pt-7 pb-[max(20px,env(safe-area-inset-bottom))] font-mono text-text shadow-2xl" style={{ clipPath: TORN, background: "var(--paper-ticket)" }}>
        <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-text-2 uppercase">
          <Dialog.Description>{ask.who}</Dialog.Description>
          <span>{ask.reference ?? ""}</span>
        </div>
        <Dialog.Title className="mt-3 text-center text-[12px] tracking-[0.35em] uppercase">{ask.title}</Dialog.Title>
        {ask.rows !== undefined ? (
          <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-text/30 pt-3 text-[13px]">
            {ask.rows.map((row) => (
              <div key={row.label} className={`flex justify-between gap-3 ${row.strong === true ? "font-bold" : ""}`} data-slip-row {...(row.strong === true ? { "data-strong": "true" } : {})}>
                <span data-slip-label>{row.label}</span>
                <span className="text-right" data-slip-value>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : ask.cost === null ? null : (
          <div className="num mt-1 text-center font-mono text-[42px] leading-none" data-slip-figure>
            {formatMoney(ask.cost.amount, ask.cost.currency)}
          </div>
        )}
        <div className="mt-3 border-t border-dashed border-text/30 pt-3 text-[13px] leading-snug">{ask.line}</div>
        {main.balance === undefined ? null : (
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[12px] text-text-2" data-ask-after>
            <span>{say("ui.world.after").toUpperCase()}</span>
            <BalanceOf balance={main.balance} formatMoney={formatMoney} className="text-[13px] text-text" />
          </div>
        )}
        {main.after === null ? null : (
          <div className={`mt-2 flex justify-between gap-3 text-[12px] ${main.shut || main.warn === true ? "font-bold text-out" : "text-text-2"}`} data-ask-after={main.balance === undefined ? "" : "due"}>
            <span>{say(main.shut ? "ui.world.short-label" : "ui.world.after").toUpperCase()}</span>
            <span className="text-right">{main.figure ?? main.after}</span>
          </div>
        )}
        <div className="mt-5 flex items-center gap-2 font-sans">
          <Dialog.Close className="h-[58px] shrink-0 rounded-[6px] border-2 border-text/20 px-4 text-[14px] font-bold">{say("ui.world.not-now")}</Dialog.Close>
          <button type="button" className="btn-main justify-center" onClick={ask.act} disabled={main.shut} data-ask-main data-short={main.shut ? "true" : undefined}>
            {ask.rows === undefined ? labelOf(ask, main, formatMoney) : ask.button}
          </button>
        </div>
      </div>
    </div>
  );
}
