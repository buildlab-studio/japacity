// One step at a time on the account sheet (world:one-action-one-sheet, world:sheets-one-frame): a step (the username's
// change, leaving a guest life, deleting the account) takes the sheet's body as its own view with one Back to the sheet, its
// heading taking the focus; a question asked in place (removing a passkey, signing out on every phone, confirming before a
// passkey is added) stands where its row stood. Opening one closes any other, and closing one hands the focus back to the
// control that opened it, so a tap never changes something out of view.
import { ChevronLeft } from "lucide-react";
import { createContext, use, useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

import { say } from "../../shared/words/text";

interface Steps {
  /** The step or question open, by its id; null on the sheet itself. */
  open: string | null;
  show: (id: string | null) => void;
}

const StepsContext = createContext<Steps | null>(null);

/** The control that opens the step `id`: the focus comes back to it as the step closes. */
export const OPENER = "data-step-opener";

/** The sheet's one open step, shared by everything on it; outside a sheet that shares one, a part keeps its own. */
export function useSteps(): [string | null, (id: string | null) => void] {
  const shared = use(StepsContext);
  const [own, setOwn] = useState<string | null>(null);
  return shared === null ? [own, setOwn] : [shared.open, shared.show];
}

export function StepsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const show = useCallback((id: string | null) => {
    if (id !== null) last.current = id;
    setOpen(id);
  }, []);
  useEffect(() => {
    if (open !== null || last.current === null) return;
    const id = last.current;
    last.current = null;
    const opener = [...(root.current?.querySelectorAll<HTMLElement>(`[${OPENER}]`) ?? [])].find((element) => element.getAttribute(OPENER) === id);
    opener?.focus();
  }, [open]);
  return (
    <StepsContext.Provider value={{ open, show }}>
      <div ref={root} className="contents">
        {children}
      </div>
    </StepsContext.Provider>
  );
}

/** An element that takes the focus as it shows: a step's heading, a question asked in place. */
export function useFocusOnShow<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

/** A step's own view: Back to the sheet, its heading, which takes the focus, and the step under it. */
export function StepView({ title, onBack, mark, children }: { title: string; onBack: () => void; mark: string; children: ReactNode }) {
  const heading = useFocusOnShow<HTMLHeadingElement>();
  const id = useId();
  return (
    <section className="motion-reveal flex flex-col gap-3" aria-labelledby={id} data-step={mark}>
      <div>
        <button type="button" className="press reach -ml-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-[15px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ink" onClick={onBack} data-step-back>
          <ChevronLeft size={18} aria-hidden />
          {say("ui.account.back")}
        </button>
      </div>
      <h3 ref={heading} id={id} tabIndex={-1} className="text-[19px] leading-tight font-bold outline-hidden">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A line that takes the focus as it shows: the question a step or a row asks. */
export function FocusLine({ children, className = "" }: { children: ReactNode; className?: string }) {
  const line = useFocusOnShow<HTMLParagraphElement>();
  return (
    <p ref={line} tabIndex={-1} className={`outline-hidden ${className}`}>
      {children}
    </p>
  );
}

/**
 * A question asked in place, brought whole into the body's view as it opens: it stands where its row stood, but is taller,
 * so its answers would otherwise open under the fold and the tap would seem to do nothing.
 */
export function useShownWhole<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => ref.current?.scrollIntoView?.({ block: "nearest" }), []);
  return ref;
}
