// What stands behind the door's figure (prologue.md R-PROLOGUE-016): on "Who are you?" a Lagos tailor's corner, on
// "Your life so far" and "Your page" the family compound, each under a translucent scrim of the theme's band so the
// figure and the sheet lead. Kept apart from the scenes, so the screens read it without loading three.js.

export type Backdrop = "corner" | "compound";

/** The screens with something behind the figure, by their marks. */
const BEHIND = new Map<string, Backdrop>([
  ["you", "corner"],
  ["life", "compound"],
  ["ready", "compound"],
  ["page", "compound"],
  ["begun", "compound"],
]);

/**
 * What stands behind a door screen, by the screen's mark: the corner behind "Who are you?", the compound behind
 * "Your life so far" (the ready lives included) and "Your page" before and after Begin; nothing behind any other.
 */
export function backdropOf(mark: string | undefined): Backdrop | null {
  return mark === undefined ? null : (BEHIND.get(mark) ?? null);
}

/** How much of the theme's band the scrim lays over the backdrop: the backdrop shows, the figure and the sheet lead. */
export const SCRIM = 0.66;
