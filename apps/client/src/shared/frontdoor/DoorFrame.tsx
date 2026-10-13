// The front door's screen (prologue.md R-PROLOGUE-013; the door's second design, A as drawn): the pale sky from edge to edge by
// day and the navy by night (the world's clock, decision 0038), the lockup on the first screen, Back as a round white
// button and Shuffle and Skip on the right on the first two screens, the screen's question as its one heading with one
// line under it, the body scrolling, and at the foot the three screens' dots over the one yellow action. On a laptop the
// screen stands in a centred column of phone width on the same sky. `data-gate` carries the screen's mark, as the gate
// did, so tests and the browser suite find each screen where they found it.
import { ChevronLeft, Shuffle } from "lucide-react";
import type { ReactNode } from "react";

import { CentredColumn } from "../ui/lively/CentredColumn";
import { Wordmark } from "../ui/Wordmark";
import { usePaint } from "../world/paint";
import { say } from "../words/text";

export interface DoorFrameProps {
  /** The screen's mark: `data-gate` carries it. */
  mark: string;
  /** The look the screen is about: `data-look` carries it. */
  look?: string | undefined;
  /** The screen's question, its one heading; null where the screen has its own. */
  title: string | null;
  /** One line under the heading, or nothing. */
  line?: ReactNode;
  /** The lockup over the heading, on the first screen alone. */
  lockup?: boolean;
  onBack?: (() => void) | null;
  onShuffle?: (() => void) | null;
  onSkip?: (() => void) | null;
  /** Which of the three screens this is, from 0, for the dots over the action; null for no dots. */
  at?: number | null;
  /** The one action at the foot, and anything over it. */
  foot?: ReactNode;
  children: ReactNode;
}

/** The three screens' dots: done ones navy, the one now a yellow dash. */
export function DoorDots({ at, count, label }: { at: number; count: number; label: string }) {
  return (
    <span className="door-dots" role="img" aria-label={label} data-door-dots={at}>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} {...(index < at ? { "data-done": "" } : index === at ? { "data-now": "" } : {})} />
      ))}
    </span>
  );
}

export function DoorFrame({ mark, look, title, line, lockup = false, onBack = null, onShuffle = null, onSkip = null, at = null, foot, children }: DoorFrameProps) {
  // The lockup's file for the ground under it: the light ground's by day, the dark's on the night's navy.
  const ground = usePaint() === "night" ? "dark" : "light";
  return (
    <div className="door-sky fixed inset-0 overflow-hidden" data-gate={mark} data-door-frame {...(look === undefined ? {} : { "data-look": look })}>
      <CentredColumn className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2.5 px-4 pt-[max(14px,env(safe-area-inset-top))]" data-door-progress>
          {onBack === null ? null : (
            <button type="button" className="round-button" aria-label={say("ui.door.back")} onClick={onBack} data-door-back>
              <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
            </button>
          )}
          {lockup ? <Wordmark ground={ground} align="start" compact className="h-[34px]" /> : null}
          <span className="flex-1" />
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
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-door-body>
          {title === null ? null : (
            <div className="px-5 pt-4">
              <h1 className="text-[24px] leading-[1.15] font-bold">{title}</h1>
              {line === undefined || line === null ? null : <div className="mt-1 text-[14px] leading-snug text-text-2">{line}</div>}
            </div>
          )}
          {children}
        </div>
        {foot === undefined && at === null ? null : (
          <div className="shrink-0 px-4 pt-2 pb-[max(18px,env(safe-area-inset-bottom))]" data-door-foot>
            {at === null ? null : (
              <div className="mb-3 flex justify-center">
                <DoorDots at={at} count={3} label={say("prologue.door.step", { n: at + 1, count: 3 })} />
              </div>
            )}
            {foot}
          </div>
        )}
      </CentredColumn>
    </div>
  );
}

/** The one yellow action: its word, and a smaller word for where it goes with an arrow, or the word alone in the middle. */
export function DoorAction({ word, then, onClick, disabled = false }: { word: string; then?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`press-button w-full ${then === undefined ? "" : "justify-between!"}`} onClick={onClick} disabled={disabled} data-door-action>
      <span>{word}</span>
      {then === undefined ? null : (
        // Where it goes is shown, not said: the button's name is its word, as the suite and a screen reader call it.
        <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-medium opacity-85" aria-hidden>
          <span className="truncate">{then}</span>
          <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      )}
    </button>
  );
}
