// The desk: the door's layout on a desktop (prologue:front-door-three-screens), a window at least `tuning.city.desktopMinWidth`
// CSS pixels wide and DESK_MIN_HEIGHT tall. A narrower or shorter window is a phone, and so is a page that cannot answer
// media queries (a test's document, the first paint before one is asked), so the phone's screens stand where nothing says
// otherwise. A fine pointer is asked apart from the size: the line of keys shows on one alone.
import { content } from "@japacity/content";
import { useSyncExternalStore } from "react";

/** The shortest window the desk stands in, in CSS pixels: below it the panel would hold too little of a step. */
export const DESK_MIN_HEIGHT = 640;
/** From this width the page stands to the right of the figure on the stage; below it, smaller than the figure and clear of the panel. */
export const DESK_WIDE_PX = 1280;

/** The media query of the desk. */
export function deskQuery(minWidth: number = content.tuning.city.desktopMinWidth): string {
  return `(min-width: ${String(minWidth)}px) and (min-height: ${String(DESK_MIN_HEIGHT)}px)`;
}

/** The pointer that can show a line of keys: a mouse or a trackpad, never a finger alone. */
export const FINE_POINTER = "(pointer: fine)";

function listOf(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query);
}

/** Whether the page answers `query` now; false where it cannot answer. */
export function mediaMatches(query: string): boolean {
  return listOf(query)?.matches === true;
}

/** Follows a media query while mounted: false where the page cannot answer it. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const list = listOf(query);
      if (list === null || typeof list.addEventListener !== "function") return () => undefined;
      list.addEventListener("change", changed);
      return () => list.removeEventListener("change", changed);
    },
    () => mediaMatches(query),
    () => false,
  );
}

/** True while the window is a desk. */
export function useDesk(): boolean {
  return useMedia(deskQuery());
}
