// The reduced-motion setting for a test (world.md R-WORLD-023): the page's media query stubbed to answer as asked, and
// turned while the screen is open, as a player changing it in their phone's settings would. Undo with
// `vi.unstubAllGlobals()`.
import { vi } from "vitest";

import { REDUCED_MOTION } from "../ui/motion";

export interface StubbedMotion {
  /** Turns the setting and tells whoever listens, as the phone does. */
  set(reduced: boolean): void;
}

export function stubReducedMotion(reduced: boolean): StubbedMotion {
  let now = reduced;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return query === REDUCED_MOTION ? now : false;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    set(next: boolean): void {
      now = next;
      for (const listener of listeners) listener();
    },
  };
}
