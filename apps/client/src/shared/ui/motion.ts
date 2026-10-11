// Whether the interface moves at all here (world.md R-WORLD-023): not under reduced motion, where every change snaps, and
// not where the page cannot say (a test's document has no media queries), so nothing waits on a motion never drawn.

/** True when a motion will be drawn: the page can answer media queries and reduced motion is not asked for. */
export function motionOn(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
