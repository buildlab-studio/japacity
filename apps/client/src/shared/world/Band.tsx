// The top band (docs/rules/world.md R-WORLD-002): the month and the place's name, the money as a
// counter, and End month. Nothing else. It hides while riding and while the results show.
import type { PlayerView } from "@japacity/sim";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { localCurrency } from "../words/wayHome";

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

/**
 * The money the band counts (R-WORLD-002): the money the character lives on where they are, bank and
 * cash together. At home the naira; abroad the country's own, so the naira left at home shows only in
 * the Bank app.
 */
export function bandMoney(view: Pick<PlayerView, "place" | "pockets">): Pick<BandProps, "money" | "formatMoney"> {
  const currency = localCurrency(view) ?? "NGN";
  const pocket = view.pockets[currency];
  return { money: pocket.bank + pocket.cash, formatMoney: (value) => formatMoney(value, currency) };
}

export interface BandProps {
  /** The clock: the character's age, small over the name. */
  when: string;
  /** The place's name, or the room's. */
  name: string;
  money: number;
  formatMoney: (value: number) => string;
  onEndMonth: () => void;
  /** The turns left to spend, under End month. */
  turns?: number;
  /** The months the player may still play, drawn beside the age (R-WORLD-027). */
  count?: ReactNode;
  /** Why the month cannot end now, or null when it can. */
  endBlocked?: string | null;
  hidden?: boolean;
  /** The second row (the nudge, what is coming), shown while the band is open or peeking; the handle under the band opens it (R-WORLD-002). */
  more?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
}

/**
 * The band is one slim row (R-WORLD-002): the place and the clock, the money, End month with the turns
 * left. A handle under it opens the second row; closed, that row peeks for a few seconds whenever its
 * words change, then gets out of the way.
 */
export function Band({ when, name, money, formatMoney, onEndMonth, turns, count, endBlocked = null, hidden = false, more, open = false, onToggle }: BandProps) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-[38] px-3 pt-[max(10px,env(safe-area-inset-top))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`} data-band aria-hidden={hidden} data-open={open}>
      <div className="band pointer-events-auto flex h-[54px] items-center gap-1.5 rounded-[6px] pl-3 pr-1.5 shadow-[0_8px_20px_rgba(10,14,30,0.3)]">
        <div className="min-w-0 flex-1 leading-none">
          <div className="label label-strong truncate text-[9px] tabular-nums">{when}</div>
          <h2 className="title mt-0.5 truncate text-[16px] leading-tight">{name}</h2>
        </div>
        {count}
        <div className="chip px-2 py-1">
          <Counter value={money} format={formatMoney} className="text-[14px]" />
        </div>
        <button type="button" className="press flex h-[42px] flex-col items-end justify-center rounded-[5px] bg-white/12 px-2 leading-tight disabled:opacity-60" onClick={onEndMonth} disabled={endBlocked !== null} title={endBlocked ?? undefined} aria-label={say("ui.world.end-month")} data-end-month>
          <span className="text-[12px] font-extrabold">{say("ui.world.end-month")}</span>
          {turns === undefined ? null : <span className="num text-[11px] font-bold opacity-80">{say("ui.world.turns", { count: turns })}</span>}
        </button>
      </div>
      {onToggle === undefined ? null : (
        <div className="flex justify-center">
          <button type="button" className="band pointer-events-auto -mt-px flex h-5 w-12 items-center justify-center rounded-b-[6px]" onClick={onToggle} aria-label={say(open ? "ui.world.show-less" : "ui.world.show-more")} aria-expanded={open} data-band-handle>
            <ChevronDown size={14} strokeWidth={2.6} className={open ? "rotate-180" : ""} aria-hidden />
          </button>
        </div>
      )}
      {more}
    </div>
  );
}
