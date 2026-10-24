// A toast in a person's voice (docs/design/09-the-lively-layer.md sections 2 and 4; the hand's toasts): under the band, a
// picture, the speaker's name pill and their few words, standing a few seconds and gone. The interview's close says
// "Your answers are in." in the officer's voice this way (interview:answers-taken-in-order).
import { useEffect, useRef } from "react";

import { Tile } from "../tiles/Tile";
import { Face } from "../ui/look/Face";

/** How long a said toast stands, as the brief's done toast does. */
export const SAID_TOAST_MS = 3000;

export interface Said {
  /** A key that changes with each new toast. */
  at: number;
  /** Who says it, as their name pill shows it. */
  who: string;
  words: string;
  /** The id whose tile is its picture. */
  picture: string;
}

export function SaidToast({ said, onGone }: { said: Said; onGone: () => void }) {
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    const timer = window.setTimeout(() => gone.current(), SAID_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [said.at]);
  return (
    <div className="brief-toast slide-in pointer-events-auto mt-2 flex w-full items-center gap-2.5 p-2 pr-3" role="status" data-said-toast>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-tint-plain">
        <span className="sticker-cut" style={{ rotate: "-5deg" }}>
          <Tile of={said.picture} size={34} />
        </span>
      </span>
      <div className="min-w-0">
        <Face name={said.who} className="text-[13px]" />
        <p className="mt-1 text-[16px] leading-snug font-bold">{said.words}</p>
      </div>
    </div>
  );
}
