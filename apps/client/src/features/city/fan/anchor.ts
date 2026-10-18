// Where the fanned thing first stood on the screen (docs/design/09-the-lively-layer.md section 3). The scene's frame loop
// moves the fan with its thing every frame, as it moves the marks and the speech bubble, straight on the DOM node; it also
// reports the thing's point here, and the fan lays its buttons out once from the first point it hears, so React renders
// the fan once per opening and never per frame.
import { listeners } from "../../../shared/listeners/listeners";

/** A point on the screen in CSS pixels, or "off" when the thing stood off the screen. */
export type FanPoint = { x: number; y: number } | "off";

let anchored: { id: string; first: FanPoint } | null = null;
const { subscribe, notify } = listeners();

/** The scene's report of the fanned thing's point this frame; only the first report of an opening is kept. */
export function anchorFan(id: string, at: { x: number; y: number } | null): void {
  if (anchored?.id === id) return;
  anchored = { id, first: at === null ? "off" : { x: at.x, y: at.y } };
  notify();
}

/** The first point heard for the thing, or null while none has come. */
export function fanAnchor(id: string): FanPoint | null {
  return anchored?.id === id ? anchored.first : null;
}

/** Forget the point once the fan closes, so the next opening reads the thing where it stands then. */
export function clearFanAnchor(id: string): void {
  if (anchored?.id !== id) return;
  anchored = null;
  notify();
}

export const subscribeFanAnchor = subscribe;
