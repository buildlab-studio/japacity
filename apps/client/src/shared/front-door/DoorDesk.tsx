// The front door on a desk (prologue:front-door-three-screens, `shared/ui/desk`): one layout that stays mounted while the steps
// change. A band across the top on the sky's own ground: Back and the lockup at its left on every step, the three steps as
// tabs in its centre in the dots' place (the step now marked, a step done ticked and a way back to it), Shuffle and Skip at
// its right, quieter than the yellow action. Under it the stage at the left and the centre, and the panel docked at the
// right: the step's heading and its one line, the step's choices, and a foot that stays put with the one yellow action and,
// on a fine pointer, the line of keys. The page never scrolls; the panel's body scrolls inside it where the window is short.
// `data-gate` carries the step's mark as DoorFrame's does, so tests and the browser suite find each step in both layouts.
import { Check, ChevronLeft, Shuffle } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";

import { Wordmark } from "../ui/Wordmark";
import { usePaint } from "../world/paint";
import { say } from "../words/text";

/** A step in the band: its heading, whether it is the one now or done, and the way back to it once done. */
export interface DeskStep {
  title: string;
  state: "done" | "now" | "ahead";
  onGo: (() => void) | null;
}

export interface DoorDeskProps {
  mark: string;
  look: string;
  steps: readonly DeskStep[];
  onBack?: (() => void) | null;
  onShuffle?: (() => void) | null;
  onSkip?: (() => void) | null;
  /** What stands on the stage: the figure on its floor and the page beside it. */
  stage: ReactNode;
  title: string;
  line?: ReactNode;
  /** The one yellow action, and anything under it. */
  foot: ReactNode;
  /** The line of keys under the action, or null. */
  keys?: ReactNode;
  children: ReactNode;
}

/** The three steps as tabs: a number in a disc, or a tick once done; a done step goes back to itself. */
function StepTabs({ steps }: { steps: readonly DeskStep[] }) {
  return (
    <nav aria-label={say("ui.door.steps")} data-door-tabs>
      <ol className="flex items-center gap-1.5">
        {steps.map((step, at) => {
          const disc = (
            <span className="desk-tab-disc" aria-hidden>
              {step.state === "done" ? <Check size={14} strokeWidth={3.2} /> : at + 1}
            </span>
          );
          return (
            <li key={step.title} className="flex items-center gap-1.5">
              {at === 0 ? null : <span className="desk-tab-rule" aria-hidden />}
              {step.state === "done" && step.onGo !== null ? (
                <button type="button" className="desk-tab" onClick={step.onGo} data-door-tab="done">
                  {disc}
                  <span>{step.title}</span>
                </button>
              ) : (
                <span className="desk-tab" {...(step.state === "now" ? { "aria-current": "step" as const } : {})} data-door-tab={step.state}>
                  {disc}
                  <span>{step.title}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DoorDesk({ mark, look, steps, onBack = null, onShuffle = null, onSkip = null, stage, title, line, foot, keys = null, children }: DoorDeskProps) {
  const ground = usePaint() === "night" ? "dark" : "light";
  // The panel stays mounted from step to step, so each step's body opens at its top.
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (body.current !== null) body.current.scrollTop = 0;
  }, [mark]);
  return (
    <div className="door-sky fixed inset-0 flex flex-col overflow-hidden" data-gate={mark} data-door-frame data-door-desk data-look={look}>
      <div className="relative z-10 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 pt-4 pb-3" data-door-progress>
        <div className="flex min-w-0 items-center gap-3">
          {onBack === null ? (
            <span className="size-11 shrink-0" aria-hidden />
          ) : (
            <button type="button" className="round-button" aria-label={say("ui.door.back")} onClick={onBack} data-door-back>
              <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
            </button>
          )}
          <Wordmark ground={ground} align="start" compact className="h-[34px]" />
        </div>
        <StepTabs steps={steps} />
        <div className="flex items-center justify-end gap-2.5">
          {onShuffle === null ? null : (
            <button type="button" className="round-button" aria-label={say("ui.door.shuffle.all")} title={say("ui.door.shuffle.all")} onClick={onShuffle} data-door-shuffle>
              <Shuffle size={20} strokeWidth={2.4} aria-hidden />
            </button>
          )}
          {onSkip === null ? null : (
            <button type="button" className="pill-button" onClick={onSkip} data-door-skip>
              {say("ui.door.skip")}
            </button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-6 px-6 pb-6">
        <div className="relative min-w-0 flex-1" data-door-stage>
          {stage}
        </div>
        <section className="door-card flex w-[460px] shrink-0 flex-col overflow-hidden" aria-labelledby="door-desk-title" data-door-panel>
          <div className="shrink-0 px-6 pt-5">
            <h1 id="door-desk-title" className="text-[24px] leading-[1.15] font-bold">
              {title}
            </h1>
            {line === undefined || line === null ? null : <div className="mt-1 text-[14px] leading-snug text-text-2">{line}</div>}
          </div>
          <div ref={body} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-3" data-door-body>
            {children}
          </div>
          <div className="shrink-0 border-t-[1.5px] border-sheet-line px-5 pt-3.5 pb-4" data-door-foot>
            {foot}
            {keys}
          </div>
        </section>
      </div>
    </div>
  );
}

/** The line of keys under the action, on a fine pointer: each key as a cap with what it does. */
export function DeskKeys({ keys }: { keys: readonly { caps: readonly string[]; does: string }[] }) {
  return (
    <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[12px] font-semibold text-text-2" data-door-keys>
      {keys.map((one) => (
        <span key={one.does} className="inline-flex items-center gap-1">
          {one.caps.map((cap) => (
            <kbd key={cap} className="desk-key">
              {cap}
            </kbd>
          ))}
          <span>{one.does}</span>
        </span>
      ))}
    </p>
  );
}
