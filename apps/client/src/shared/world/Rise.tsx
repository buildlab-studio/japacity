// The rise (japacity.md R-JAPACITY-003; the design): every rise of the figure
// flies up as "+9" in the band's colours toward the band and fades, while the bag by the door grows.
// One at a time, never a queue: a new rise takes the place of one still flying. A fall shows nothing
// but the bag shrinking. While a sheet covers the world the figure waits, so the player sees the rise
// and the bag's growth together once it closes. Each motion is under half a second (R-WORLD-023): it
// pops in, holds still, then flies; reduced motion leaves the fade.
import { useEffect, useRef, useState } from "react";

/** How long the rise holds still after popping in, before it flies. */
export const RISE_HOLD_MS = 900;
/** The flight up toward the band, fading as it goes. */
export const RISE_FLY_MS = 450;
/** The whole of a rise, from popping in to gone. */
export const RISE_MS = RISE_HOLD_MS + RISE_FLY_MS;

export interface Risen {
  /** The points gained. */
  by: number;
  /** Which rise this is, so a new one restarts the flight. */
  at: number;
  flying: boolean;
}

/** The points a change of the figure gained, or 0 for a fall or no change; a first figure counts from nothing. */
export function riseOf(before: number | null, now: number | null): number {
  if (now === null) return 0;
  return Math.max(0, now - (before ?? 0));
}

/**
 * The figure the world shows and the rise flying, if any. `open` is true while nothing covers the
 * world: until then the figure shown keeps its old value, and no rise flies.
 */
export function useJapaRise(percent: number | null, open: boolean): { figure: number | null; rise: Risen | null } {
  const [seen, setSeen] = useState(percent);
  const [rise, setRise] = useState<Risen | null>(null);
  const count = useRef(0);
  useEffect(() => {
    if (!open || percent === seen) return;
    const by = riseOf(seen, percent);
    setSeen(percent);
    if (by === 0) return;
    count.current += 1;
    setRise({ by, at: count.current, flying: false });
  }, [percent, open, seen]);
  const at = rise?.at ?? null;
  useEffect(() => {
    if (at === null) return;
    const fly = window.setTimeout(() => setRise((now) => (now?.at === at ? { ...now, flying: true } : now)), RISE_HOLD_MS);
    const gone = window.setTimeout(() => setRise((now) => (now?.at === at ? null : now)), RISE_MS);
    return () => {
      window.clearTimeout(fly);
      window.clearTimeout(gone);
    };
  }, [at]);
  return { figure: seen, rise };
}

/** The rise over the world, under the band, flying up to it. */
export function Rise({ rise }: { rise: Risen | null }) {
  if (rise === null) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[38%] z-[39] flex justify-center" aria-hidden data-rise={rise.by} data-flying={rise.flying}>
      <div key={rise.at} className="pop">
        <div className={`band rounded-[6px] px-4 py-1.5 shadow-[0_8px_20px_rgba(10,14,30,0.3)] transition-[translate,opacity] duration-450 ease-in ${rise.flying ? "-translate-y-[30vh] opacity-0" : ""}`}>
          <span className="num text-[28px] leading-none">+{rise.by}</span>
        </div>
      </div>
    </div>
  );
}
