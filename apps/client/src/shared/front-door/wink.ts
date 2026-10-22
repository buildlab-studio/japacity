// The lines with a wink (account:two-lights-and-wink-lines, text:hook-not-explanation): a few places carry two or three
// lines at most, and one is picked at random once per visit on the device, so a reload may show another. Never
// from the player's data, and never on bad news. The words are in content's ui/ui.online.text.ts.
import { deviceRandom, type RandomBelow } from "../net/random";

/** The places that carry a line with a wink, and how many lines each has. */
export const WINK_LINES = { start: 3 } as const;

export type WinkPlace = keyof typeof WINK_LINES;

/** A line's two rows, as word keys: `ui.wink.<place>.<n>.a` and `.b`. */
export type WinkRows = readonly [string, string];

declare global {
  interface Window {
    /** Dev builds only: fixes a place's line (1 is the first) for the pictures. A production build never reads it. */
    __wink?: Partial<Record<WinkPlace, number>>;
  }
}

const picked = new Map<WinkPlace, number>();

/** The line fixed by the dev-only hook, or null; a production build has no hook. */
function fixed(place: WinkPlace): number | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const asked = window.__wink?.[place];
  return asked !== undefined && Number.isInteger(asked) && asked >= 1 && asked <= WINK_LINES[place] ? asked : null;
}

/** The line for a place this visit: drawn once on the device and kept until the page goes. */
export function winkFor(place: WinkPlace, random: RandomBelow = deviceRandom): WinkRows {
  const n = fixed(place) ?? picked.get(place) ?? random(WINK_LINES[place]) + 1;
  picked.set(place, n);
  return [`ui.wink.${place}.${String(n)}.a`, `ui.wink.${place}.${String(n)}.b`];
}

/**
 * The line of a place that stands on its own where nothing of the light hangs: the offline
 * door has no lights, so of the start screen's three it carries "Japa is not by force. / How ready are you?" alone.
 */
const WITHOUT_THE_LIGHTS: Record<WinkPlace, number> = { start: 3 };

/** That line's two rows, as word keys. */
export function winkAlone(place: WinkPlace): WinkRows {
  const n = WITHOUT_THE_LIGHTS[place];
  return [`ui.wink.${place}.${String(n)}.a`, `ui.wink.${place}.${String(n)}.b`];
}

/** For tests: a new visit. */
export function forgetWinks(): void {
  picked.clear();
}
