// A toast under the band (docs/design/09-the-games-look.md sections 2 and 4; the hand's toasts): a picture, the speaker's
// name pill where someone speaks and their few words, or an act done at once with its name and, where an answer is to
// come, when it comes as a tag (world:things-are-tappable-models). It slides in, stands a few seconds and slides out
// again. The interview's close says "Your answers are in." in the officer's voice this way (interview:answers-taken-in-order).
import { useEffect, useRef, useState } from "react";

import { Tile } from "../tiles/Tile";
import { Mark } from "../ui/Mark";
import { StateTag } from "../ui/StateTag";
import { Face } from "../ui/look/Face";

/** How long a said toast stands, as the brief's done toast does. */
export const SAID_TOAST_MS = 3000;
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
  const gone = useRef(onGone);
  gone.current = onGone;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setLeaving(false);
    const out = window.setTimeout(() => setLeaving(true), SAID_TOAST_MS - TOAST_OUT_MS);
    const timer = window.setTimeout(() => gone.current(), SAID_TOAST_MS);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(timer);
    };
  }, [said.at]);
  const act = said.act !== undefined;
  return (
    <div className={`brief-toast ${leaving ? "slide-out" : "slide-in"} pointer-events-auto mt-2 flex w-full items-center gap-2.5 p-2 pr-3`} role="status" data-said-toast {...(act ? { "data-act-toast": said.act } : {})}>
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
