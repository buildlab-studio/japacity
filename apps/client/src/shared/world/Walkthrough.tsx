// The first-play walkthrough (docs/rules/world.md R-WORLD-027): once per device, after Go on the
// opening words, four pointers one at a time, each a small card with an arrow at the thing and one
// line: the band, the phone, the map, the month's count. A tap moves on. Nothing lectures before play,
// and it never shows again: the device keeps that it was seen, as the phone keeps its seen marks.
import { useEffect, useLayoutEffect, useState } from "react";

import { say } from "../words/text";

export const WALK_KEY = "japacity.walkthrough";

/** The four pointers, in order: what each points at, and its one line. */
export const WALK_STEPS = [
  { id: "band", target: "[data-band] > .band", words: "ui.walk.band" },
  { id: "phone", target: '[data-thumb="phone"]', words: "ui.walk.phone" },
  { id: "map", target: '[data-thumb="map"]', words: "ui.walk.map" },
  { id: "count", target: "[data-month-count]", words: "ui.walk.count" },
  // The bag by the door (R-WORLD-031): pointed at from the band, since the bag stands in the scene.
  { id: "bag", target: "[data-band] > .band", words: "ui.walk.bag" },
] as const;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** True once this device has shown the walkthrough. */
export function walkSeen(): boolean {
  try {
    const kept = storage();
    return kept !== null && kept.getItem(WALK_KEY) !== null;
  } catch {
    return false;
  }
}

/** Keeps on the device that the walkthrough has shown, so it never shows again. */
export function markWalkSeen(): void {
  try {
    storage()?.setItem(WALK_KEY, "1");
  } catch {
    // Storage may be shut; the walkthrough is then seen for this visit only.
  }
}

export interface Spot {
  x: number;
  top: number;
  bottom: number;
}

function spotOf(selector: string): Spot | null {
  const found = document.querySelector(selector);
  if (found === null) return null;
  const box = found.getBoundingClientRect();
  return { x: box.left + box.width / 2, top: box.top, bottom: box.bottom };
}

/** The bottom of the nudge under the band, or null when none shows: a card below the band stands under it, never over it. */
function nudgeBottom(): number | null {
  const found = document.querySelector("[data-nudge]");
  if (found === null) return null;
  const box = found.getBoundingClientRect();
  return box.height > 0 ? box.bottom : null;
}

/** The next pointer, or past the last once every one has shown. */
function forward(at: number | null): number {
  return at === null ? 0 : Math.min(at + 1, WALK_STEPS.length);
}

const CARD_WIDTH = 260;
const GUTTER = 12;
const ARROW = 10;

/**
 * Where a pointer's card stands (R-WORLD-027): a thing in the top half gets its
 * card below it, one in the bottom half above; a card below the band stands under the nudge (`clear`, its
 * bottom), pointing up from there, so the nudge is never covered.
 */
export function cardPlace(spot: Spot | null, clear: number | null, width: number, height: number): { below: boolean; left: number; arrow: number; place: { top: number } | { bottom: number } } {
  const x = spot?.x ?? width / 2;
  const below = spot === null || spot.top < height / 2;
  const left = Math.min(Math.max(GUTTER, x - CARD_WIDTH / 2), Math.max(GUTTER, width - GUTTER - CARD_WIDTH));
  const arrow = Math.min(Math.max(14, x - left), CARD_WIDTH - 14);
  const under = Math.max(spot?.bottom ?? height / 3, below && clear !== null ? clear : 0);
  const place = below ? { top: under + ARROW + 4 } : { bottom: height - (spot?.top ?? (height * 2) / 3) + ARROW + 4 };
  return { below, left, arrow, place };
}

/**
 * `active`: the opening words have just been passed and nothing covers the world. The walkthrough
 * starts the first time it is active on a device that has not seen it, and runs to its end.
 */
export function Walkthrough({ active }: { active: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [clear, setClear] = useState<number | null>(null);

  useEffect(() => {
    if (!active || step !== null || walkSeen()) return;
    // Seen once it starts: a reload part way through does not bring it back.
    markWalkSeen();
    setStep(0);
  }, [active, step]);

  const current = step === null ? undefined : WALK_STEPS[step];
  useLayoutEffect(() => {
    if (current === undefined) return;
    const measure = (): void => {
      setSpot(spotOf(current.target));
      setClear(nudgeBottom());
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [current]);

  useEffect(() => {
    if (current === undefined) return;
    const key = (event: KeyboardEvent): void => {
      if (event.key === "Enter" || event.key === " " || event.key === "Escape") setStep(forward);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [current]);

  if (current === undefined || !active || step === null) return null;
  const width = typeof window === "undefined" ? 390 : window.innerWidth;
  const height = typeof window === "undefined" ? 844 : window.innerHeight;
  const { below, left, arrow, place } = cardPlace(spot, clear, width, height);

  return (
    <div className="fixed inset-0 z-[55]" onClick={() => setStep(forward)} data-walkthrough={current.id}>
      <div className="panel pop absolute px-3.5 py-3" style={{ left, width: CARD_WIDTH, ...place }} data-walk-card>
        <span
          className="absolute size-3.5 rotate-45 bg-sheet"
          style={{ left: arrow - 7, ...(below ? { top: -6 } : { bottom: -6 }) }}
          aria-hidden
        />
        <p className="relative text-[15px] leading-snug font-bold" aria-live="polite">
          {say(current.words)}
        </p>
        <p className="relative mt-1 flex justify-between gap-2 text-[12px] font-semibold text-text-2">
          <span>{say("ui.walk.step", { n: step + 1, count: WALK_STEPS.length })}</span>
          <span data-walk-on>{say("ui.walk.on")}</span>
        </p>
      </div>
    </div>
  );
}
