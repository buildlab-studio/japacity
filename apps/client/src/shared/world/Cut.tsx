// The cut (docs/rules/world.md R-WORLD-013): the screen goes dark for under half a second, the scene
// changes behind it, and it comes back. Every scene change but the ride goes through it.
import { useCallback, useRef, useState } from "react";

// The hold at the darkest point: with the fades either side it reads as a cut, and it leaves the scene swap room under the half second (R-WORLD-013).
export const CUT_MS = 260;

/** `cutTo(then)` darkens the screen, runs `then` at the darkest point, and lifts the dark again. */
export function useCut(): { cutting: boolean; cutTo: (then: () => void) => void } {
  const [cutting, setCutting] = useState(false);
  const timers = useRef<number[]>([]);
  const cutTo = useCallback((then: () => void) => {
    for (const timer of timers.current) window.clearTimeout(timer);
    setCutting(true);
    timers.current = [
      window.setTimeout(() => {
        // The lift is timed from the darkest point, before the change runs: a slow scene swap eats into the hold instead of stretching the dark past the rule.
        timers.current.push(window.setTimeout(() => setCutting(false), CUT_MS));
        then();
      }, CUT_MS),
    ];
  }, []);
  return { cutting, cutTo };
}

export function Cut({ cutting }: { cutting: boolean }) {
  return <div aria-hidden className={`pointer-events-none fixed inset-0 z-[60] bg-device transition-opacity duration-300 ${cutting ? "opacity-100" : "opacity-0"}`} data-cut={cutting} />;
}
