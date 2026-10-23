// The top band (world:top-band-is-lively-pill): the age and the place's name, the month's name with the world's part of
// the day (clock:game-day-on-real-time), and the money as a counter. Nothing else. It hides while riding and while the results
// show. The month turns when the life sleeps (decision 0011), so the band carries no Next month and no count of anything.
import { text } from "@japacity/content";
import type { DayPart, PlayerView } from "@japacity/sim";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { BandPerson } from "../datapage/PageSheet";
import { CentredColumn } from "../ui/lively/CentredColumn";
import { motionReduced } from "../ui/motion";
import { formatMoney } from "../words/format";
import { dayPartWords, monthNameOf } from "../words/monthName";
import { say } from "../words/text";
import { localCurrency } from "../words/wayHome";

/** How long the money takes to count to its new value: under half a second (world:motions-under-half-second). */
export const COUNT_MS = 450;

/** A number that counts toward its new value over about half a second (world:motions-under-half-second). */
export function Counter({ value, format, className = "" }: { value: number; format: (value: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const change = value - start;
    if (change === 0) return;
    // Reduced motion: the number lands at once (world:motions-under-half-second).
    if (motionReduced()) {
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
 * The money the band counts (world:top-band-is-lively-pill): the money the character lives on where they are, bank and
 * cash together. At home the naira; abroad the country's own, so the naira left at home shows only in
 * the Bank app.
 */
export function bandMoney(view: Pick<PlayerView, "place" | "pockets">): Pick<TopBandProps, "money" | "formatMoney"> {
  const currency = localCurrency(view);
  const pocket = view.pockets[currency];
  return { money: pocket.bank + pocket.cash, formatMoney: (value) => formatMoney(value, currency) };
}

/**
 * The month as the band says it (world:top-band-is-lively-pill, clock:game-day-on-real-time): the month of the year by when the life began, and the world's
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

export interface TopBandProps {
  /** The clock: the character's age, small over the name. */
  when: string;
  /** The place's name, or the room's. */
  name: string;
  money: number;
  formatMoney: (value: number) => string;
  /** The month's name and the part of the day, a small chip beside the age; none outside a game. */
  month?: BandMonth;
  /** The body's word beside the age, only when it complains (quality:body-belly-and-energy): "Hungry", "Tired", "Hungry, tired". */
  body?: string | null;
  /** A tap on the month opens the phone's Calendar. */
  onMonth?: () => void;
  /** The world's part of the day, for the sky's picture at the band's start. */
  sky?: DayPart;
  /** While a fan's button is pressed, what the money would be after it (docs/design/09-the-lively-layer.md section 2). */
  preview?: number | null;
  hidden?: boolean;
  /** The second row (the nudge, what is coming), shown while the band is open or peeking; the handle under the band opens it (world:top-band-is-lively-pill). */
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
 * The month on the band (world:top-band-is-lively-pill, clock:game-day-on-real-time): the world's part of the day beside the name, "· Morning", as the
 * lively band draws it (docs/design/09-the-lively-layer.md); the month's name rides in it for a
 * screen reader and the Calendar it opens shows it whole. A new part of the day fades in, short and on opacity alone.
 */
function MonthChip({ month, onMonth }: { month: BandMonth; onMonth?: (() => void) | undefined }) {
  return (
    <button type="button" className="band-part press reach shrink-0 text-[14px] leading-none text-text-2" onClick={onMonth} aria-label={say("ui.month.chip", { name: month.name, part: month.part })} data-band-month={month.part}>
      <span className="sr-only">{month.name}</span>
      <span key={month.part} className="fade" data-band-part>
        {month.part}
      </span>
    </button>
  );
}

/** The picture for each part of the world's day, a stand-in until the sky has a tile of its own. */
const SKY_PICTURES: Readonly<Record<DayPart, string>> = { morning: "🌤️", afternoon: "☀️", evening: "🌇", night: "🌙" };

/**
 * The band (world:top-band-is-lively-pill) as the lively layer draws it: a white pill by day and a navy one at night, the sky's picture,
 * the name with the part of the day beside it and the age and the place small under it, the body's word as a chip when
 * it complains, and the money in green. No pattern on it (decision 0025). A handle under it opens the second row;
 * closed, that row peeks for a few seconds whenever its words change. On a laptop it stands in the centred column.
 * While a fan's button is pressed the counter shows what would be left, and settles back when it is let go.
 */
export function TopBand({ when, name, money, formatMoney, month, body = null, onMonth, sky, preview = null, hidden = false, more, open = false, onToggle }: TopBandProps) {
  const previewing = preview !== null && preview !== money;
  return (
    <CentredColumn className={`pointer-events-none fixed inset-x-0 top-0 z-[38] px-3 pt-[max(12px,env(safe-area-inset-top))] transition-opacity duration-300 ${hidden ? "opacity-0" : ""}`} data-band aria-hidden={hidden} data-open={open}>
      <div className="band-pill pointer-events-auto flex min-h-[52px] items-center gap-2 py-1.5 pr-1.5 pl-2" data-band-pill>
        {sky === undefined ? null : (
          <span className="band-sky flex size-8 shrink-0 items-center justify-center text-[18px] leading-none" aria-hidden data-band-sky={sky}>
            {SKY_PICTURES[sky]}
          </span>
        )}
        <BandPerson when={when} place={bandPlace(name)} body={body} part={month === undefined ? null : <MonthChip month={month} onMonth={onMonth} />} />
        <div className={`band-money shrink-0 px-3 py-1.5 ${previewing ? "band-money-preview" : ""}`} data-band-money data-band-preview={previewing ? preview : undefined}>
          <Counter value={previewing ? preview : money} format={formatMoney} className="text-[16px]" />
        </div>
      </div>
      {onToggle === undefined ? null : (
        <div className="flex justify-center">
          <button type="button" className="band-pill reach pointer-events-auto -mt-1 flex h-5 w-12 items-center justify-center rounded-b-[10px] rounded-t-none" onClick={onToggle} aria-label={say(open ? "ui.world.show-less" : "ui.world.show-more")} aria-expanded={open} data-band-handle>
            <ChevronDown size={14} strokeWidth={2.6} className={open ? "rotate-180" : ""} aria-hidden />
          </button>
        </div>
      )}
      {more}
    </CentredColumn>
  );
}
