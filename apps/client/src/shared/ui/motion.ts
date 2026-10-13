// Whether the interface moves at all here (world.md R-WORLD-023): not under reduced motion, where every change snaps, and
// not where the page cannot say (a test's document has no media queries), so nothing waits on a motion never drawn.
import { type RefObject, useEffect, useRef } from "react";

/** The setting people who get motion sick turn on: the phone asks for as little motion as can be. */
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The page's answer to the setting, or null where it cannot answer (no window, or no media queries). */
function reducedQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION);
}

/**
 * True when the player's phone asks for reduced motion. Where the page cannot say, false: a motion drawn by the code
 * itself (the camera's ease) goes on as it always has, and only the setting itself stills it.
 */
export function motionReduced(): boolean {
  return reducedQuery()?.matches === true;
}

/** True when a motion will be drawn: the page can answer media queries and reduced motion is not asked for. */
export function motionOn(): boolean {
  const query = reducedQuery();
  return query !== null && !query.matches;
}

/**
 * The setting for a frame loop to read each frame without asking the page: a ref that holds `motionReduced()` and
 * follows the player changing it while the game is open.
 */
export function useMotionReduced(): RefObject<boolean> {
  const reduced = useRef(motionReduced());
  useEffect(() => {
    const query = reducedQuery();
    if (query === null) return;
    const follow = (): void => {
      reduced.current = query.matches;
    };
    follow();
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return reduced;
}

/** A layout box, as offsets inside the positioned parent: what a transform does not change. */
export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutBox(element: HTMLElement): LayoutBox {
  return { x: element.offsetLeft, y: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight };
}

/**
 * The transform that draws an element laid out in `last` where it stood in `first`, turned `degrees` as it stood there:
 * the inverted step of FLIP. Its functions line up with the resting transforms' (translate, rotate, scale), so the
 * browser eases each on its own and the frame stays a rectangle all the way.
 */
export function invertedTransform(first: LayoutBox, last: LayoutBox, degrees: number): string {
  const dx = first.x + first.width / 2 - (last.x + last.width / 2);
  const dy = first.y + first.height / 2 - (last.y + last.height / 2);
  const sx = last.width === 0 ? 1 : first.width / last.width;
  const sy = last.height === 0 ? 1 : first.height / last.height;
  return `translate(${String(dx)}px, ${String(dy)}px) rotate(${String(degrees)}deg) scale(${String(sx)}, ${String(sy)})`;
}
