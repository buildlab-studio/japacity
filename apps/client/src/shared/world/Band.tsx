// The top band (docs/rules/world.md R-WORLD-002): the age and the place's name, the month's name with the world's part of
// the day (clock.md R-CLOCK-033), and the money as a counter. Nothing else. It hides while riding and while the results
// show. The month turns when the life sleeps (decision 0036), so the band carries no Next month and no count of anything.
import { text } from "@japacity/content";
import type { DayPart, PlayerView } from "@japacity/sim";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { BandPerson } from "../datapage/PageSheet";
import { formatMoney } from "../words/format";
import { dayPartWords, monthNameOf } from "../words/monthName";
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

/**
 * The month as the band says it (R-WORLD-002, R-CLOCK-033): the month of the year by when the life began, and the world's
 * part of the day in words, from the world's clock, never the month's time.
 */
export function bandMonth(view: Pick<PlayerView, "month">, beganAt: number, clock: { part: DayPart }): BandMonth {
  return { name: monthNameOf(beganAt, view.month), part: dayPartWords(clock.part) };
}

export interface BandMonth {
  /** The month of the year: "April". */
  name: string;
  /** The world's part of the day, in words: Morning, Afternoon, Evening, Night. */
  part: string;
}

export interface BandProps {
  /** The clock: the character's age, small over the name. */
  when: string;
  /** The place's name, or the room's. */
  name: string;
  money: number;
  formatMoney: (value: number) => string;
  /** The month's name and the part of the day, a small chip beside the age; none outside a game. */
  month?: BandMonth;
  /** The body's word beside the age, only when it complains (R-QUALITY-007): "Hungry", "Tired", "Hungry, tired". */
  body?: string | null;
  /** A tap on the month opens the phone's Calendar. */
  onMonth?: () => void;
  hidden?: boolean;
  /** The second row (the nudge, what is coming), shown while the band is open or peeking; the handle under the band opens it (R-WORLD-002). */
  more?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
}

/** Each place's name with a short one, as the band may be handed it: content's casing and with its first letter raised. */
const SHORTS: ReadonlyMap<string, string> = new Map(
  Object.entries(text).flatMap(([key, short]) => {
    const id = /^(place\.[a-z0-9-]+)\.short$/.exec(key)?.[1];
    const name = id === undefined ? undefined : text[`${id}.name`];
    if (name === undefined) return [];
    return [
      [name, short],
      [name.charAt(0).toUpperCase() + name.slice(1), short],
    ];
  }),
);

/** The place as the band says it: its own short name where content gives one, so it fits beside the name. */
export function bandPlace(name: string): string {
  if (name === say("ui.inside.hub")) return say("ui.inside.hub.short");
  return SHORTS.get(name) ?? name;
}

/**
 * The month on the band (R-WORLD-002, R-CLOCK-033): its name over the world's part of the day, where the pages were. A
 * new part of the day fades in, short and on opacity alone, so the day moving on is seen without a jolt.
 */
function MonthChip({ month, onMonth }: { month: BandMonth; onMonth?: (() => void) | undefined }) {
  return (
    <button
      type="button"
      className="press flex h-[42px] min-w-[58px] shrink-0 flex-col items-center justify-center rounded-[5px] bg-white/12 px-2 leading-tight"
      onClick={onMonth}
      aria-label={say("ui.month.chip", { name: month.name, part: month.part })}
      data-band-month={month.part}
    >
      <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase">{month.name}</span>
      <span key={month.part} className="fade text-[11px] font-bold opacity-80" data-band-part>
        {month.part}
      </span>
    </button>
  );
}

/**
 * The band is one slim row (R-WORLD-002): the place and the clock, the month's name and the part of the day, the money. A handle
 * under it opens the second row; closed, that row peeks for a few seconds whenever its words change, then gets out of
 * the way.
 */
export function Band({ when, name, money, formatMoney, month, body = null, onMonth, hidden = false, more, open = false, onToggle }: BandProps) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-[38] px-3 pt-[max(10px,env(safe-area-inset-top))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`} data-band aria-hidden={hidden} data-open={open}>
      <div className="band pointer-events-auto flex h-[54px] items-center gap-1.5 rounded-[6px] pl-3 pr-1.5 shadow-[0_8px_20px_rgba(10,14,30,0.3)]">
        <BandPerson when={when} place={bandPlace(name)} body={body} />
        {month === undefined ? null : <MonthChip month={month} onMonth={onMonth} />}
        <div className="chip px-2 py-1">
          <Counter value={money} format={formatMoney} className="text-[14px]" />
        </div>
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
