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
      <ol className="desk-tabs">
        {steps.map((step, at) => {
          const disc = (
            <span className="desk-tab-disc" aria-hidden>
              {step.state === "done" ? <Check size={14} strokeWidth={3.2} /> : at + 1}
            </span>
          );
          const Tab = step.state === "done" && step.onGo !== null ? "button" : "span";
          return (
            <li key={step.title}>
              {at === 0 ? null : <span className="desk-tab-rule" aria-hidden />}
              <Tab {...(Tab === "button" ? { type: "button" as const, onClick: step.onGo ?? undefined } : {})} className="desk-tab" aria-current={step.state === "now" ? "step" : undefined} data-door-tab={step.state}>
                {disc}
                <span>{step.title}</span>
              </Tab>
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
    <div className="door-sky desk" data-gate={mark} data-door-frame data-door-desk data-look={look}>
      <div className="desk-band" data-door-progress>
        <div className="desk-band-side">
          {onBack === null ? (
            <span className="desk-band-gap" aria-hidden />
          ) : (
            <button type="button" className="round-button" aria-label={say("ui.door.back")} onClick={onBack} data-door-back>
              <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
            </button>
          )}
          <Wordmark ground={ground} align="start" compact className="h-[34px]" />
        </div>
        <StepTabs steps={steps} />
        <div className="desk-band-side desk-band-end">
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
      <div className="desk-main">
        <div className="desk-stage-box" data-door-stage>
          {stage}
        </div>
        <section className="door-card desk-panel" aria-labelledby="door-desk-title" data-door-panel>
          <div className="desk-panel-head">
            <h1 id="door-desk-title">
              {title}
            </h1>
            {line === undefined || line === null ? null : <div className="desk-panel-line">{line}</div>}
          </div>
          <div ref={body} className="desk-panel-body" data-door-body>
            {children}
          </div>
          <div className="desk-panel-foot" data-door-foot>
            {foot}
            {keys}
          </div>
        </section>
      </div>
    </div>
  );
}
