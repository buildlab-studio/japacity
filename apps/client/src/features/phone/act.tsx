// How an app acts (world:one-action-one-sheet, world:phone-rises-over-scene): every act that costs or decides
// opens the shared sheet with its own card; the main button sends the act's command, and the corner
// tells it is done. A refusal shows in the app, in content's words.
import type { Currency } from "@japacity/sim";
import { CircleAlert, X } from "lucide-react";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import type { PlayerCommand } from "../../authority/store";
import { formatMoney } from "../../shared/words/format";
import { AskSheet } from "../../shared/world/AskSheet";
import type { Ask } from "../../shared/world/contract";
import { iconFor } from "./PhoneIcon";
import { say } from "../../shared/words/text";

/** The phone's told line: an app says what happened, the corner over the handset shows it (world:street-talk-budget). */
export const PhoneSaid = createContext<(words: string) => void>(() => undefined);

/**
 * The app's one way back (world:phone-rises-over-scene): an app on an inner screen of its own (a Chats thread, the People slots) hands the
 * handset its way back to its first screen, and the head's Back takes it; on its first screen Back returns to the grid.
 * Two ways back stacked, the head's arrow and a link of the app's own under it, read as the same thing twice.
 */
export const PhoneBack = createContext<(back: (() => void) | null) => void>(() => undefined);

/** Hands the head's Back to an inner screen while `back` is given; null hands it back to the grid. */
export function useInnerBack(back: (() => void) | null): void {
  const hand = use(PhoneBack);
  const latest = useRef(back);
  latest.current = back;
  const inner = back !== null;
  useEffect(() => {
    hand(inner ? () => latest.current?.() : null);
    return () => hand(null);
  }, [inner, hand]);
}

export interface AskSpec {
  form: Ask["form"];
  icon: string;
  who: string;
  title: string;
  line: string;
  cost: { amount: number; currency: Currency } | null;
  button: string;
  /**
   * What the cost comes out of now, for "what is left after". Left out, the sheet counts the pockets
   * itself and holds what is left against the month's dues, so the card warns before a bill goes unpaid.
   */
  have?: number;
  /** "now" when the act happens at once; the default counts when the month ends (world:one-action-one-sheet). */
  when?: Ask["when"];
  command: PlayerCommand;
  /** The line told in the corner once it is done. */
  done: string;
  reference?: string;
}

/** One sheet at a time for an app: `open` shows a card or a slip, `sheet` is the element to render. */
export function useAsk(): { open: (spec: AskSpec) => void; sheet: ReactNode; asking: boolean } {
  const [shown, setShown] = useState<{ ask: Ask; have: number | undefined } | null>(null);
  const send = useGame((state) => state.send);
  const said = use(PhoneSaid);
  const open = (spec: AskSpec) => {
    const ask: Ask = {
      form: spec.form,
      icon: spec.icon,
      who: spec.who,
      title: spec.title,
      line: spec.line,
      cost: spec.cost,
      button: spec.button,
      ...(spec.reference === undefined ? {} : { reference: spec.reference }),
      ...(spec.when === undefined ? {} : { when: spec.when }),
      act: () => {
        setShown(null);
        void send(spec.command).then((reply) => {
          if (reply?.ok === true) said(spec.done);
        });
      },
      dismiss: () => setShown(null),
    };
    setShown({ ask, have: spec.have });
  };
  const have = shown === null ? 0 : shown.have;
  const sheet = <AskSheet ask={shown?.ask ?? null} {...(have === undefined ? {} : { from: have })} formatMoney={(amount, currency) => formatMoney(amount, currency as Currency)} icon={iconFor} />;
  return { open, sheet, asking: shown !== null };
}

/** The last refusal, where the player acted, until they close it or act again. */
export function Refused() {
  const rejection = useGame((state) => state.rejection);
  const dismiss = useGame((state) => state.dismissRejection);
  if (rejection === null) return null;
  return (
    <div role="alert" className="shake lively-card mb-3 flex items-start gap-2 p-3 text-[15px] text-out">
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1">{rejection.words}</p>
      <button type="button" onClick={dismiss} aria-label={say("ui.dismiss")} className="flex size-7 items-center justify-center">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/** A small heading inside an app, in sentence case ("Your briefs"). */
export function Head({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 mb-2 px-0.5 text-[15px] font-semibold text-text-2 first:mt-1">{children}</h3>;
}

/** A choice among a few, as one segmented pill: the phone never shows a form. */
export function Chips<T extends string>({ label, value, options, onChange, shown = false }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; shown?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex items-center gap-1 ${shown ? "flex-wrap" : "phone-segment p-1"}`}>
      {shown ? (
        <span className="w-full px-0.5 text-[13px] font-semibold text-text-2" aria-hidden>
          {label}
        </span>
      ) : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`press min-h-10 px-3 text-[14px] font-bold whitespace-nowrap ${shown ? "" : "flex-auto"} ${option.value === value ? "phone-segment-on" : "text-text-2"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
