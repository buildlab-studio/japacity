// A toast under the band (docs/design/09-the-games-look.md sections 2 and 4; the hand's toasts): a picture, the speaker's
// name pill where someone speaks and their few words, or an act done at once with its name and, where an answer is to
// come, when it comes as a tag (world:things-are-tappable-models). It slides in, stands a few seconds and slides out
// again. The interview's close says "Your answers are in." in the officer's voice this way (interview:answers-taken-in-order).
import { useEffect, useRef, useState } from "react";

import { Tile } from "../tiles/Tile";
import { Mark } from "../ui/Mark";
import { StateTag } from "../ui/StateTag";
import { Face } from "../ui/look/Face";

/** The least a toast stands (world:things-are-tappable-models): long enough to read a few words. */
export const SAID_TOAST_MS = 4000;
/** Words past this many letters stand a second longer for each `LETTERS_A_SECOND` more. */
const SHORT_WORDS = 40;
const LETTERS_A_SECOND = 12;

/** How long a toast with these words stands: at least four seconds, and a second more for every twelve letters past forty. */
export function toastMs(words: string): number {
  return SAID_TOAST_MS + Math.max(0, Math.ceil((words.length - SHORT_WORDS) / LETTERS_A_SECOND)) * 1000;
}

/**
 * A toast's time, held while a finger or the pointer rests on it (world:things-are-tappable-models): the time left runs only while
 * nothing holds it, and `onOut` comes `TOAST_OUT_MS` before `onGone`, for the slide out.
 */
export function useToastTime(key: number, ms: number, onOut: () => void, onGone: () => void): { onPointerEnter: () => void; onPointerLeave: () => void; onPointerDown: () => void; onPointerUp: () => void; onPointerCancel: () => void } {
  const out = useRef(onOut);
  out.current = onOut;
  const gone = useRef(onGone);
  gone.current = onGone;
  const left = useRef(ms);
  const since = useRef(0);
  const timers = useRef<number[]>([]);
  const held = useRef(0);
  const stop = (): void => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  };
  const run = (): void => {
    stop();
    since.current = Date.now();
    timers.current = [window.setTimeout(() => out.current(), Math.max(0, left.current - TOAST_OUT_MS)), window.setTimeout(() => gone.current(), left.current)];
  };
  useEffect(() => {
    left.current = ms;
    held.current = 0;
    run();
    return stop;
    // A new toast starts its own time.
  }, [key, ms]);
  const hold = (): void => {
    held.current += 1;
    if (held.current > 1) return;
    stop();
    left.current = Math.max(TOAST_OUT_MS, left.current - (Date.now() - since.current));
  };
  const free = (): void => {
    if (held.current === 0) return;
    held.current -= 1;
    if (held.current === 0) run();
  };
  return { onPointerEnter: hold, onPointerLeave: free, onPointerDown: hold, onPointerUp: free, onPointerCancel: free };
}
/** How long it takes to slide out, inside the time it stands (world:motions-under-half-second). */
export const TOAST_OUT_MS = 220;

export interface Said {
  /** A key that changes with each new toast. */
  at: number;
  /** Who says it, as their name pill shows it; none for an act's own toast. */
  who?: string;
  words: string;
  /** The id whose tile is its picture. */
  picture: string;
  /** An act done at once: its id, so the toast is known as the act's. */
  act?: string;
  /** When the act's answer comes, as a waiting tag; an act with none is marked done. */
  tag?: string | null;
}

export function SaidToast({ said, onGone }: { said: Said; onGone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [said.at]);
  const time = useToastTime(said.at, toastMs(said.words), () => setLeaving(true), onGone);
  const act = said.act !== undefined;
  return (
    <div className={`brief-toast ${leaving ? "slide-out" : "slide-in"} pointer-events-auto mt-2 flex w-full items-center gap-2.5 p-2 pr-3`} role="status" data-said-toast {...(act ? { "data-act-toast": said.act } : {})} {...time}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-tint-plain">
        <span className="sticker-cut" style={{ rotate: "-5deg" }}>
          <Tile of={said.picture} size={34} />
        </span>
      </span>
      <div className="min-w-0">
        {said.who === undefined ? null : <Face name={said.who} className="text-[13px]" />}
        <p className={`${said.who === undefined ? "" : "mt-1 "}flex items-center gap-1.5 text-[16px] leading-snug font-bold`}>
          <span className="min-w-0">{said.words}</span>
          {act && (said.tag ?? null) === null ? <Mark state="done" size={18} /> : null}
        </p>
        {act && said.tag !== undefined && said.tag !== null ? (
          <span className="mt-1 flex">
            <StateTag state="waiting" id="act-due">
              {said.tag}
            </StateTag>
          </span>
        ) : null}
      </div>
    </div>
  );
}
