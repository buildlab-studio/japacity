// Toasts that answer every tap (docs/design/13-the-lively-layer.md sections 2 and 7):
// money that comes in from something the player did slides in under the band as a toast with a picture, what it was and
// the figure on a green pill, a coin flies from it to the band's counter and the counter counts; it plays the coin's cue,
// and goes after a few seconds. Money going out is the price the player tapped and needs no toast.
import { useEffect, useRef, useState } from "react";

import { cue } from "../sound/cues";
import { Tile } from "../tiles/Tile";

/** How long a money toast stands. */
export const MONEY_TOAST_MS = 3000;
/** How long the coin's flight to the counter takes: under half a second (R-WORLD-023). */
export const COIN_MS = 420;

export interface MoneyIn {
  /** A key that changes with each new toast. */
  at: number;
  /** What brought it in, in a few words: the act's name. */
  title: string;
  /** The figure in, already in words, with its sign. */
  amount: string;
  /** The id whose tile is its picture. */
  picture: string;
}

/** The toast, under the band in its column; the coin flies to `[data-band-money]` and the toast goes after MONEY_TOAST_MS. */
export function MoneyToast({ toast, onGone }: { toast: MoneyIn; onGone: () => void }) {
  const pill = useRef<HTMLSpanElement>(null);
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    cue("coin");
    const from = pill.current?.getBoundingClientRect();
    const to = document.querySelector("[data-band-money]")?.getBoundingClientRect();
    if (from !== undefined && to !== undefined) setFlight({ x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + 12) });
    const timer = window.setTimeout(() => gone.current(), MONEY_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast.at]);
  return (
    <div className="brief-toast slide-in pointer-events-auto mt-2 flex w-full items-center gap-3 p-2.5 pr-3" role="status" data-money-toast>
      <span className="flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-tint-money">
        <span className="sticker-cut" style={{ rotate: "-6deg" }}>
          <Tile of={toast.picture} size={40} />
        </span>
      </span>
      <span className="min-w-0 flex-1 text-[18px] leading-tight font-bold">{toast.title}</span>
      <span ref={pill} className="band-money relative shrink-0 px-3 py-1.5 text-[18px]" data-money-toast-amount>
        {toast.amount}
        {flight === null ? null : (
          <span aria-hidden className="coin-fly absolute top-0 left-1/2 block size-6 -translate-x-1/2 rounded-full text-[18px] leading-6" style={{ ["--tx" as string]: `${String(flight.x)}px`, ["--ty" as string]: `${String(flight.y)}px` }} data-coin>
            🪙
          </span>
        )}
      </span>
    </div>
  );
}
