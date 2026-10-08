// The cut (docs/rules/world.md R-WORLD-013): the screen goes dark for under half a second, the scene
// changes behind it, and it comes back. Every scene change but the ride goes through it.
import { useCallback, useRef, useState } from "react";

export const CUT_MS = 320;

/** `cutTo(then)` darkens the screen, runs `then` at the darkest point, and lifts the dark again. */
export function useCut(): { cutting: boolean; cutTo: (then: () => void) => void } {
  const [cutting, setCutting] = useState(false);
  const timers = useRef<number[]>([]);
  const cutTo = useCallback((then: () => void) => {
    for (const timer of timers.current) window.clearTimeout(timer);
    setCutting(true);
    timers.current = [
      window.setTimeout(() => {
        then();
        timers.current.push(window.setTimeout(() => setCutting(false), CUT_MS));
      }, CUT_MS),
    ];
  }, []);
  return { cutting, cutTo };
}

export function Cut({ cutting }: { cutting: boolean }) {
  return <div aria-hidden className={`pointer-events-none fixed inset-0 z-[60] bg-device transition-opacity duration-300 ${cutting ? "opacity-100" : "opacity-0"}`} data-cut={cutting} />;
}
