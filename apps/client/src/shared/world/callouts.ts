// The callout budget (the talk budget, docs/design/13-the-lively-layer.md section 5; the plan 6.3): at most three
// callouts over the scene at once. The fan the player opened, the road's chip and the marker come first, in that order;
// a word bubble is the fourth and waits. The band and the thumbs are chrome and never count.

/** The most callouts over the scene at once. */
export const CALLOUTS_MAX = 3;

export type Callout = "fan" | "chip" | "marker" | "bubble";

/** The order callouts are kept in when there are too many: what the player opened first, the talk last. */
const ORDER: readonly Callout[] = ["fan", "chip", "marker", "bubble"];

/** Which of the callouts that want to show may: up to CALLOUTS_MAX of them, by ORDER. */
export function calloutsShown(wanted: Readonly<Record<Callout, boolean>>): Record<Callout, boolean> {
  const shown: Record<Callout, boolean> = { fan: false, chip: false, marker: false, bubble: false };
  let count = 0;
  for (const callout of ORDER) {
    if (!wanted[callout] || count >= CALLOUTS_MAX) continue;
    shown[callout] = true;
    count += 1;
  }
  return shown;
}
