// One action, one sheet (docs/rules/world.md R-WORLD-006). The sheet takes the form of what it
// shows: a card for an ask or a choice, a paper slip with a torn edge for a paper thing. One main
// button, which also says what is left after; one way to say not now. The scene stays in view.
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { say } from "../words/text";
import type { Ask } from "./contract";

export interface AskSheetProps {
  ask: Ask | null;
  /** The money in the cost's currency now, for "what is left after". */
  have: number;
  formatMoney: (amount: number, currency: string) => string;
  /** The icon for the card's corner, by the ask's icon name. */
  icon?: (name: string) => ReactNode;
}

function afterWords(ask: Ask, have: number, formatMoney: AskSheetProps["formatMoney"]): string | null {
  if (ask.cost === null) return null;
  return say("ui.world.left", { amount: formatMoney(have - ask.cost.amount, ask.cost.currency) });
}

export function AskSheet({ ask, have, formatMoney, icon }: AskSheetProps) {
  const open = ask !== null;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) ask?.dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fade fixed inset-0 z-40 bg-gradient-to-t from-scrim to-transparent data-closed:pointer-events-none data-ending-style:pointer-events-none" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 outline-hidden data-closed:pointer-events-none data-ending-style:pointer-events-none" data-ask-form={ask?.form}>
          {ask === null ? null : ask.form === "card" ? <Card ask={ask} after={afterWords(ask, have, formatMoney)} formatMoney={formatMoney} icon={icon} /> : <Slip ask={ask} after={afterWords(ask, have, formatMoney)} formatMoney={formatMoney} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Card({ ask, after, formatMoney, icon }: { ask: Ask; after: string | null; formatMoney: AskSheetProps["formatMoney"]; icon: AskSheetProps["icon"] }) {
  return (
    <div className="panel rise mx-2 mb-2 overflow-hidden">
      <div className="band relative flex items-end gap-3 px-4 pt-4 pb-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[5px] bg-sheet text-strong">{icon?.(ask.icon)}</div>
        <div className="min-w-0 flex-1">
          <Dialog.Description className="label label-strong truncate">{ask.who}</Dialog.Description>
          <Dialog.Title className="title text-[24px] leading-none">{ask.title}</Dialog.Title>
        </div>
        <Dialog.Close aria-label={say("ui.world.close")} className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full text-on-strong/80">
          <X size={18} />
        </Dialog.Close>
      </div>
      <div className="p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <p className="text-[15px] leading-snug text-text-2">{ask.line}</p>
        {ask.cost === null ? null : (
          <div className="mt-3 flex items-baseline justify-between border-y border-sheet-line py-2.5">
            <span className="text-[14px] font-semibold">{say("ui.world.costs")}</span>
            <span className="num text-[26px]">{formatMoney(ask.cost.amount, ask.cost.currency)}</span>
          </div>
        )}
        <button type="button" className="btn-main mt-4" onClick={ask.act} data-ask-main>
          <span>{ask.button}</span>
          {after === null ? null : <span className="text-[13px] font-semibold opacity-80">{after}</span>}
        </button>
      </div>
    </div>
  );
}

const TORN = "polygon(0 8px, 4% 0, 8% 8px, 12% 0, 16% 8px, 20% 0, 24% 8px, 28% 0, 32% 8px, 36% 0, 40% 8px, 44% 0, 48% 8px, 52% 0, 56% 8px, 60% 0, 64% 8px, 68% 0, 72% 8px, 76% 0, 80% 8px, 84% 0, 88% 8px, 92% 0, 96% 8px, 100% 0, 100% 100%, 0 100%)";

function Slip({ ask, after, formatMoney }: { ask: Ask; after: string | null; formatMoney: AskSheetProps["formatMoney"] }) {
  return (
    <div className="rise mx-auto w-[88%] max-w-[360px]">
      <div className="px-5 pt-7 pb-[max(20px,env(safe-area-inset-bottom))] font-mono text-text shadow-2xl" style={{ clipPath: TORN, background: "var(--paper-ticket)" }}>
        <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-text-2 uppercase">
          <Dialog.Description>{ask.who}</Dialog.Description>
          <span>{ask.reference ?? ""}</span>
        </div>
        <Dialog.Title className="mt-3 text-center text-[12px] tracking-[0.35em] uppercase">{ask.title}</Dialog.Title>
        {ask.cost === null ? null : <div className="num mt-1 text-center font-mono text-[42px] leading-none">{formatMoney(ask.cost.amount, ask.cost.currency)}</div>}
        <div className="mt-3 border-t border-dashed border-text/30 pt-3 text-[13px] leading-snug">{ask.line}</div>
        {after === null ? null : (
          <div className="mt-2 flex justify-between text-[12px] text-text-2">
            <span>{say("ui.world.after").toUpperCase()}</span>
            <span>{after}</span>
          </div>
        )}
        <div className="mt-5 flex items-center gap-2 font-sans">
          <Dialog.Close className="h-[58px] shrink-0 rounded-[6px] border-2 border-text/20 px-4 text-[14px] font-bold">{say("ui.world.not-now")}</Dialog.Close>
          <button type="button" className="btn-main justify-center" onClick={ask.act} data-ask-main>
            {ask.button}
          </button>
        </div>
      </div>
    </div>
  );
}
