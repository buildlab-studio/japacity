// The months the player may still play (docs/rules/world.md R-WORLD-027): a small calendar drawn with
// the number on it, on the band beside the age at all times. Never a sentence on the band and never a
// prompt: a tap gives the words, the count and when the next month comes, or that the bank is full.
// The calendar is the design's glyph; the button keeps "End month".
import { useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { cue } from "../../shared/sound/cues";
import { say, sayCount } from "../../shared/words/text";
import { waitWords } from "./TurnClock";

/** The count drawn on a small calendar: the number on the page, the binding rings over it. */
export function MonthGlyph({ n, size = 26 }: { n: number; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size * 1.15 }} aria-hidden data-month-glyph>
      <svg viewBox="0 0 26 30" width={size} height={size * 1.15} className="absolute inset-0">
        <rect x="1" y="4" width="24" height="25" rx="2" fill="var(--on-strong)" />
        <rect x="1" y="4" width="24" height="6" rx="2" fill="var(--signal)" />
        <path d="M7 1v6M19 1v6" stroke="var(--on-strong)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className={`num relative text-[var(--strong)] ${n > 9 ? "text-[12px]" : "text-[14px]"}`} style={{ marginTop: 6 }}>
        {n}
      </span>
    </span>
  );
}

/**
 * The words a tap on the count gives (R-WORLD-027): "You can play 12 more months. Next one in 1h 40m.",
 * or "Full" when the bank holds its most. The wait is the server's clock, read through the store; the
 * local authority reports none, so only the count is said there.
 */
export function countWords(banked: number, cap: number, nextTurnAt: number | null | undefined, now: number): string {
  if (banked >= cap) return say("ui.months.full", { count: cap });
  const count = sayCount("ui.months.more", banked, { count: banked });
  if (nextTurnAt === undefined || nextTurnAt === null) return count;
  const next = now >= nextTurnAt ? say("ui.months.arriving") : say("ui.months.next", { wait: waitWords(nextTurnAt - now) });
  return `${count} ${next}`;
}

/** How long the words stay before they fold away by themselves. */
const SHOWN_MS = 6000;

/** The count on the band, and its words at a tap. */
export function MonthCount() {
  const view = useView();
  const nextTurnAt = useGame((state) => state.clock?.nextTurnAt);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const held = useRef<HTMLDivElement>(null);
  const { banked, cap } = view.turns;

  useEffect(() => {
    if (!open) return;
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
          setOpen((was) => !was);
        }}
        aria-label={say("ui.months.label", { count: banked })}
        aria-expanded={open}
        data-month-count={banked}
      >
        <MonthGlyph n={banked} />
      </button>
      {open ? (
        <p className="panel drop pointer-events-auto fixed inset-x-3 top-[calc(max(10px,env(safe-area-inset-top))+62px)] z-[39] mx-auto max-w-[360px] px-3.5 py-3 text-[14px] leading-snug font-semibold" aria-live="polite" data-month-count-words>
          {countWords(banked, cap, nextTurnAt, now)}
        </p>
      ) : null}
    </div>
  );
}
