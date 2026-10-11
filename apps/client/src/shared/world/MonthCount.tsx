// The pages left on the flip calendar (docs/rules/world.md R-WORLD-027): a small calendar drawn with
// the number on it, on the band beside the age at all times, each page a month of the character's life.
// Never a sentence on the band and never a prompt: a tap opens the phone's Calendar app, whose pages say the count
// and when the next page comes, or that the calendar is full (R-WORLD-002). The page turned flips over on
// the glyph, on the spot.
import { BookOpen, Calendar, CalendarCheck, CalendarDays, CalendarX, Clock, Flag, Map as MapIcon, Smartphone, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { cue } from "../sound/cues";
import { say, sayCount } from "../words/text";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** A wait on the server's clock in words: "1h 40m", "25m", "under a minute" (R-CLOCK-007). */
export function waitWords(ms: number): string {
  if (ms < MINUTE_MS) return say("ui.clock.under-minute");
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  return hours > 0 ? say("ui.clock.hours", { hours, minutes: String(minutes).padStart(2, "0") }) : say("ui.clock.minutes", { minutes });
}

/**
 * The count on a flip calendar (the design's glyph): the pages under the top
 * one while there are any, the bare backing card when there are none. With `flip`, the top page still
 * shows the old number and flips up over the rings on the spot, the next number underneath.
 */
export function MonthGlyph({ n, size = 26, flip = false }: { n: number; size?: number; flip?: boolean }) {
  const shown = flip ? n + 1 : n;
  const height = size * 1.15;
  // The page's box in the glyph's 26 by 30 units: from under the rings to the foot.
  const page = { left: size / 26, right: size / 26, top: (7 / 30) * height, bottom: height / 30 };
  const number = (value: number) => (
    <span className={`num text-[var(--strong)] ${value > 9 ? "text-[12px]" : "text-[14px]"}`} style={{ opacity: value === 0 ? 0.45 : 1 }}>
      {value}
    </span>
  );
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height }} aria-hidden data-month-glyph data-month-flip={flip ? "true" : undefined}>
      <svg viewBox="0 0 26 30" width={size} height={height} className="absolute inset-0">
        {n > 1 || (flip && n > 0) ? <rect x="2.5" y="9" width="23" height="21" rx="1.5" fill="var(--on-strong)" opacity="0.45" /> : null}
        <rect x="1" y="7" width="24" height="22" rx="1.5" fill="var(--on-strong)" opacity={n === 0 && !flip ? 0.3 : 1} />
        <rect x="1" y="3" width="24" height="6" rx="1.5" fill="var(--signal)" />
        <path d="M7 1v5M13 1v5M19 1v5" stroke="var(--on-strong)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="absolute flex items-center justify-center" style={{ ...page, top: page.top + 2 }}>
        {number(n)}
      </span>
      {flip ? (
        <span className="flip-page absolute" style={page}>
          <span className="flex items-center justify-center pt-[2px]">{number(shown)}</span>
          <span />
        </span>
      ) : null}
    </span>
  );
}

/** How long the page takes to flip over on the spot. */
export const FLIP_MS = 600;

/** One fact a tap on the count gives: its icon and a few words (R-TEXT-008). */
export interface CountFact {
  id: string;
  icon: LucideIcon;
  words: string;
}

/**
 * The facts a tap on the count gives (R-WORLD-027, R-TEXT-008): the pages left, that a page is a month of your life,
 * and when the next page comes; "Full" when the bank holds its most, with the chapter that fills it again; out of
 * pages, none left, when the next comes and what is still free. The wait is the server's clock, read through the
 * store; the local authority reports none, so no wait is said there.
 */
export function countFacts(banked: number, cap: number, nextTurnAt: number | null | undefined, now: number): CountFact[] {
  if (banked >= cap) {
    return [
      { id: "full", icon: CalendarCheck, words: say("ui.months.fact.full", { count: cap }) },
      { id: "chapter", icon: BookOpen, words: say("ui.months.fact.chapter") },
    ];
  }
  const next: CountFact[] =
    nextTurnAt === undefined || nextTurnAt === null ? [] : [{ id: "next", icon: Clock, words: now >= nextTurnAt ? say("ui.months.fact.arriving") : say("ui.months.fact.next", { wait: waitWords(nextTurnAt - now) }) }];
  if (banked === 0) {
    return [
      { id: "none", icon: CalendarX, words: say("ui.months.fact.none") },
      ...next,
      { id: "places", icon: MapIcon, words: say("ui.months.fact.places") },
      { id: "phone", icon: Smartphone, words: say("ui.months.fact.phone") },
      { id: "plan", icon: Flag, words: say("ui.months.fact.plan") },
    ];
  }
  return [
    { id: "left", icon: Calendar, words: sayCount("ui.months.fact.left", banked, { count: banked }) },
    { id: "page", icon: CalendarDays, words: say("ui.months.fact.page") },
    ...next,
  ];
}

/** How long the words stay before they fold away by themselves. */
const SHOWN_MS = 6000;

/** The count on the band. A tap opens the Calendar app where the shell hands `onOpen`, else gives the words. */
export function MonthCount({ onOpen }: { onOpen?: () => void } = {}) {
  const view = useView();
  const nextTurnAt = useGame((state) => state.clock?.nextTurnAt);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const held = useRef<HTMLDivElement>(null);
  const { banked, cap } = view.turns;
  // The page turned flips over on the glyph, on the spot: the count going down by one is the turn.
  const [flip, setFlip] = useState(false);
  const last = useRef(banked);
  const lastMonth = useRef(view.month);
  // The calendar full again between months, not by a chapter, is said on the band at once.
  const [refilled, setRefilled] = useState(false);
  useEffect(() => {
    const was = last.current;
    const wasMonth = lastMonth.current;
    last.current = banked;
    lastMonth.current = view.month;
    if (banked >= cap && banked > was && view.month === wasMonth) {
      setRefilled(true);
      setOpen(true);
      return;
    }
    if (banked !== was - 1) return;
    setFlip(true);
    const done = window.setTimeout(() => setFlip(false), FLIP_MS);
    return () => window.clearTimeout(done);
  }, [banked]);

  useEffect(() => {
    if (!open) {
      setRefilled(false);
      return;
    }
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const fold = window.setTimeout(() => setOpen(false), SHOWN_MS);
    // A tap anywhere else folds the words away.
    const away = (event: PointerEvent): void => {
      if (held.current !== null && event.target instanceof Node && held.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(fold);
      document.removeEventListener("pointerdown", away);
    };
  }, [open]);

  return (
    <div ref={held} className="shrink-0">
      <button
        type="button"
        className="press flex h-[42px] items-center justify-center rounded-[5px] px-1"
        onClick={() => {
          cue("tap");
          if (onOpen !== undefined) {
            setOpen(false);
            onOpen();
            return;
          }
          setOpen((was) => !was);
        }}
        aria-label={say("ui.months.label", { count: banked })}
        aria-expanded={open}
        data-month-count={banked}
      >
        <MonthGlyph n={banked} flip={flip} />
      </button>
      {open ? (
        <ul className="panel drop pointer-events-auto fixed inset-x-3 top-[calc(max(10px,env(safe-area-inset-top))+62px)] z-[39] mx-auto flex max-w-[360px] flex-col gap-1.5 px-3.5 py-3 text-[14px] leading-tight font-semibold" aria-live="polite" data-month-count-words>
          {(refilled ? [{ id: "refilled", icon: CalendarCheck, words: say("ui.months.fact.refilled", { count: banked }) }] : countFacts(banked, cap, nextTurnAt, now)).map((fact) => (
            <li key={fact.id} className="flex items-center gap-2" data-count-fact={fact.id}>
              <fact.icon size={18} className="shrink-0 text-strong" aria-hidden />
              <span>{fact.words}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
