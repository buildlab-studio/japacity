// The top band (docs/rules/world.md R-WORLD-002): the month and the place's name, the money as a
// counter, and End month. Nothing else. It hides while riding and while the results show.
import { type ReactNode, useEffect, useRef, useState } from "react";

import { say } from "../words/text";

/** How long the money takes to count to its new value: under half a second (R-WORLD-023). */
export const COUNT_MS = 450;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A number that counts toward its new value over about half a second (R-WORLD-023). */
export function Counter({ value, format, className = "" }: { value: number; format: (value: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const change = value - start;
    if (change === 0) return;
    // Reduced motion: the number lands at once (R-WORLD-023).
    if (prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const share = Math.min(1, (now - began) / COUNT_MS);
      const eased = 1 - Math.pow(1 - share, 3);
      setShown(Math.round(start + change * eased));
      if (share < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className={`num ${className}`} data-counter={value}>
      {format(shown)}
    </span>
  );
}

export interface BandProps {
  /** The small line over the name: "Month 6". */
  when: string;
  /** The place's name, or the room's. */
  name: string;
  money: number;
  formatMoney: (value: number) => string;
  onEndMonth: () => void;
  /** Why the month cannot end now, or null when it can. */
  endBlocked?: string | null;
  hidden?: boolean;
  /** A small control under the name, such as Step outside. */
  aside?: ReactNode;
}

export function Band({ when, name, money, formatMoney, onEndMonth, endBlocked = null, hidden = false, aside }: BandProps) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-[38] px-3 pt-[max(10px,env(safe-area-inset-top))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`} data-band aria-hidden={hidden}>
      <div className="flex items-stretch gap-2">
        <div className="band pointer-events-auto flex min-w-0 flex-1 flex-col justify-center rounded-[6px] px-3 py-2 shadow-[0_10px_24px_rgba(10,14,30,0.35)]">
          <div className="label label-strong">{when}</div>
          <h2 className="title truncate text-[19px] leading-tight">{name}</h2>
          {aside}
        </div>
        <div className="pointer-events-auto flex flex-col items-end justify-between gap-1">
          <div className="chip px-2.5 py-1.5">
            <Counter value={money} format={formatMoney} className="text-[19px]" />
          </div>
          <button type="button" className="btn-dark press h-8 px-3 text-[12px] disabled:opacity-60" onClick={onEndMonth} disabled={endBlocked !== null} title={endBlocked ?? undefined} data-end-month>
            {say("ui.world.end-month")}
          </button>
        </div>
      </div>
    </div>
  );
}
