// The road in the world, only in the moment (the plan 16; the road set's pictures 01 to 05): the chip under the band
// with the brief's picture, its title and a dot for each thing; the toast in the giver's voice under it when a thing comes
// in; and the marker on the thing to do, a white pill with its words and an arrow over a breathing yellow ring. The chip
// says which brief; the marker says what to do.
import { useEffect, useRef, useState } from "react";

import { Tile } from "../../../shared/tiles/Tile";
import { Face } from "../../../shared/ui/lively/Face";
import { type Brief, briefDots, TUCK_MS, TUCK_SLIDE_MS } from "./brief";

/** How the chip stands: just handed and tucking into the phone, at the step's place, or a thing just done. */
export type ChipMoment = "handed" | "here" | "done";

/** The dots: green for a thing in, yellow for the one now, pale for the rest; a new tick pops. */
function Dots({ brief }: { brief: Brief }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden data-brief-dots>
      {briefDots(brief.items).map((dot, index) => (
        <i key={`${brief.items[index]?.id ?? String(index)}-${dot}`} className={`brief-dot brief-dot-${dot} ${dot === "done" ? "pop" : ""} block size-[7px]`} data-dot={dot} />
      ))}
    </span>
  );
}

/**
 * The chip under the band. Handed, it stands for a moment, then slides into the Phone thumb and is gone (`onTucked`);
 * at the step's place it stays, and a tap takes the step's way. A done thing's toast rides under it.
 */
export function BriefChip({ brief, moment, toast, onTap, onTucked }: { brief: Brief; moment: ChipMoment; toast?: string | null; onTap?: () => void; onTucked?: () => void }) {
  const chip = useRef<HTMLButtonElement>(null);
  const [slide, setSlide] = useState<{ x: number; y: number } | null>(null);
  const tucked = useRef(onTucked);
  tucked.current = onTucked;
  useEffect(() => {
    if (moment !== "handed") return;
    const start = window.setTimeout(() => {
      const from = chip.current?.getBoundingClientRect();
      const to = document.querySelector("[data-thumb='phone']")?.getBoundingClientRect();
      setSlide(from === undefined || to === undefined ? { x: 0, y: 0 } : { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2) });
    }, TUCK_MS);
    const end = window.setTimeout(() => tucked.current?.(), TUCK_MS + TUCK_SLIDE_MS);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, [moment]);
  return (
    <div className="pointer-events-none mt-2 flex flex-col items-start gap-2" data-nudge data-brief-chip={moment}>
      <button
        ref={chip}
        type="button"
        onClick={onTap}
        disabled={onTap === undefined}
        className={`brief-chip press pop pointer-events-auto inline-flex max-w-full items-center gap-2 py-1 pr-3 pl-1 text-[14px] font-bold ${slide === null ? "" : "brief-chip-tuck"}`}
        style={slide === null ? undefined : { ["--tx" as string]: `${String(slide.x)}px`, ["--ty" as string]: `${String(slide.y)}px` }}
        aria-label={brief.title}
        {...(onTap === undefined ? {} : { "data-nudge-open": "" })}
      >
        <span className="chip-pic flex size-[30px] shrink-0 items-center justify-center bg-tint-plain">
          <span className="sticker-cut" style={{ rotate: "-8deg" }}>
            <Tile of={brief.picture} size={24} />
          </span>
        </span>
        <span className="truncate">{brief.title}</span>
        <Dots brief={brief} />
      </button>
      {toast === null || toast === undefined ? null : (
        <div className="brief-toast slide-in pointer-events-auto flex w-full items-center gap-2.5 p-2 pr-3" role="status" data-brief-toast>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-tint-plain">
            <span className="sticker-cut" style={{ rotate: "-5deg" }}>
              <Tile of={brief.picture} size={34} />
            </span>
          </span>
          <div className="min-w-0">
            <Face name={brief.giver.name} className="text-[13px]" />
            <p className="mt-1 text-[16px] leading-snug font-bold">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The marker on the step's thing (section 4): a white pill with the thing to do and an arrow, a soft bounce, and a yellow
 * ring at its feet that breathes. The scene stands both over the thing each frame (`[data-marker]`, `[data-marker-ring]`).
 */
export function Marker({ thing, words, picture, onTap }: { thing: string; words: string; picture: string; onTap?: () => void }) {
  return (
    <>
      <div className="pointer-events-none fixed top-0 left-0 z-[36]" style={{ visibility: "hidden" }} aria-hidden data-marker-ring={thing}>
        <span className="marker-ring block h-[22px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-[50%]" />
      </div>
      <div className="pointer-events-none fixed top-0 left-0 z-[37]" style={{ visibility: "hidden" }} role="note" aria-label={words} data-marker={thing}>
        <div className="marker-bounce flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <button type="button" onClick={onTap} className="marker-pill pointer-events-auto flex items-center gap-1.5 py-1.5 pr-3 pl-1.5 text-[14px] font-bold whitespace-nowrap" aria-label={words} data-marker-tap={thing}>
            <span className="sticker-cut" style={{ rotate: "-6deg" }}>
              <Tile of={picture} size={22} />
            </span>
            {words}
          </button>
          <span className="marker-arrow mt-1 block h-0 w-0 border-x-[9px] border-t-[12px] border-x-transparent" />
        </div>
      </div>
    </>
  );
}
