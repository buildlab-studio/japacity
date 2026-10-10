// The door's pixels (prologue.md R-PROLOGUE-009): the figure's edges read clean on a phone.
// The door is one figure and a small scene, so it draws at the screen's own pixels, up to two to one, with antialiasing.

/** The pixel ratio the door's canvas draws at: the screen's own up to two, one where there is no window. */
export function doorPixels(ratio: number | undefined = typeof window === "undefined" ? undefined : window.devicePixelRatio): number {
  return ratio === undefined || !Number.isFinite(ratio) || ratio <= 0 ? 1 : Math.min(ratio, 2);
}
