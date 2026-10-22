// What a tap on the door shows, and when (prologue:front-door-three-screens). "Make it
// yours" opened, and the next part to choose in it, scroll into the door's body only as far as needed to show them
// whole, so the figure above stays in view as long as it can: smooth, or at once under reduced motion (world.md
// world:motions-under-half-second). Work that holds the main thread after a tap (drawing the figure in your colours) waits until the frame
// with the tap's answer has painted.
import { motionOn } from "../ui/motion";

/** Runs `run` once the next frame has painted; the returned function calls it off while it waits. */
export function afterPaint(run: () => void): () => void {
  let timer: number | undefined;
  const frame = window.requestAnimationFrame(() => {
    timer = window.setTimeout(run, 0);
  });
  return () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
}

/** Scrolls an element into the door's body as far as needed to show it whole. */
export function bringIntoView(element: Element | null | undefined): void {
  if (element === null || element === undefined || typeof element.scrollIntoView !== "function") return;
  element.scrollIntoView({ block: "nearest", behavior: motionOn() ? "smooth" : "instant" });
}
