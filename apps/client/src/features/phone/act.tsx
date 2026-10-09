// How an app acts (docs/rules/world.md R-WORLD-006, R-WORLD-018): every act that costs or decides
// opens the shared sheet with its own card; the main button sends the same command the old screens
// sent, and a toast says it is done. A refusal shows in the app, in content's words.
import type { Currency } from "@japacity/sim";
import { CircleAlert, X } from "lucide-react";
import { createContext, use, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import type { PlayerCommand } from "../../authority/store";
import { formatMoney } from "../../shared/words/format";
import { AskSheet } from "../../shared/world/AskSheet";
import type { Ask } from "../../shared/world/contract";
import { iconFor } from "./icons";
import { phoneWords } from "./phone.words";

/** The phone's toast: an app says what happened, the handset shows it. */
export const PhoneSaid = createContext<(words: string) => void>(() => undefined);

export interface AskSpec {
  form: Ask["form"];
  icon: string;
  who: string;
  title: string;
  line: string;
  cost: { amount: number; currency: Currency } | null;
  button: string;
  /** What the cost comes out of now, for "what is left after". */
  have: number;
  command: PlayerCommand;
  /** The toast once it is done. */
  done: string;
  reference?: string;
}

/** One sheet at a time for an app: `open` shows a card or a slip, `sheet` is the element to render. */
export function useAsk(): { open: (spec: AskSpec) => void; sheet: ReactNode; asking: boolean } {
  const [shown, setShown] = useState<{ ask: Ask; have: number } | null>(null);
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
  const sheet = <AskSheet ask={shown?.ask ?? null} from={shown?.have ?? 0} formatMoney={(amount, currency) => formatMoney(amount, currency as Currency)} icon={iconFor} />;
  return { open, sheet, asking: shown !== null };
}

/** The last refusal, where the player acted, until they close it or act again. */
export function Refused() {
  const rejection = useGame((state) => state.rejection);
  const dismiss = useGame((state) => state.dismissRejection);
  if (rejection === null) return null;
  return (
    <div role="alert" className="mb-3 flex items-start gap-2 rounded-[6px] border border-out/40 bg-sheet-2 p-2.5 text-[14px] text-out">
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1">{rejection.words}</p>
      <button type="button" onClick={dismiss} aria-label={phoneWords("ui.dismiss")} className="flex size-7 items-center justify-center">
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/** A small heading inside an app. */
export function Head({ children }: { children: ReactNode }) {
  return <h3 className="label mt-4 mb-1.5 text-text-2 first:mt-0">{children}</h3>;
}

/** A choice among a few, as chips: the phone never shows a form. */
export function Chips<T extends string>({ label, value, options, onChange, shown = false }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; shown?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {shown ? (
        <span className="label w-full text-[10px] text-text-2" aria-hidden>
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
          className={`press min-h-10 rounded-[5px] px-3 text-[14px] font-bold ${option.value === value ? "btn-dark" : "border border-sheet-line bg-sheet-2 text-text"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
