// The front door's header, as designed (prologue.md R-PROLOGUE-013): Back as a round translucent
// button, the screen's title centred over three short progress dashes, and on the first two screens Shuffle (its icon alone) and Skip as round translucent buttons on the right. The translucency is the band's own chalk, never a
// colour of its own (R-WORLD-021).
import { ChevronLeft, Shuffle } from "lucide-react";

import { Wordmark } from "../ui/Wordmark";
import { say } from "../words/text";

export interface DoorHeadProps {
  title: string;
  /** Which of the screens the run is at, from 0. */
  at: number;
  count: number;
  onBack: (() => void) | null;
  onShuffle: (() => void) | null;
  onSkip: (() => void) | null;
}

const ROUND = "press flex h-10 shrink-0 items-center justify-center rounded-full bg-on-strong/15 text-on-strong";

export function DoorHead({ title, at, count, onBack, onShuffle, onSkip }: DoorHeadProps) {
  const faster = onShuffle !== null && onSkip !== null;
  return (
    <>
      {/* The lockup heads the door's first screen, on the band as the account screens have it. */}
      {at === 0 && <Wordmark ground="dark" className="mb-2 h-8" />}
      <div className="pointer-events-auto flex items-center gap-2" data-door-progress>
        {onBack === null ? (
          <span className="w-10 shrink-0" />
        ) : (
          <button type="button" aria-label={say("ui.door.back")} className={`${ROUND} w-10`} onClick={onBack} data-door-back>
            <ChevronLeft size={20} aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1 text-center">
          <h1 className="title truncate text-[19px] leading-tight text-on-strong">{title}</h1>
          <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
            {Array.from({ length: count }, (_, index) => (
              <span key={index} className={`h-1.5 w-6 rounded-[2px] ${index <= at ? "bg-signal" : "bg-on-strong/20"}`} />
            ))}
          </div>
          <span className="sr-only">{say("prologue.door.step", { n: at + 1, count })}</span>
        </div>
        {faster ? (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" className={`${ROUND} w-10`} aria-label={say("ui.door.shuffle.all")} title={say("ui.door.shuffle.all")} onClick={onShuffle} data-door-shuffle>
              <Shuffle size={18} aria-hidden />
            </button>
            <button type="button" className={`${ROUND} px-3.5 text-[14px] font-bold`} onClick={onSkip} data-door-skip>
              {say("ui.door.skip")}
            </button>
          </div>
        ) : (
          <span className="w-10 shrink-0" />
        )}
      </div>
    </>
  );
}
