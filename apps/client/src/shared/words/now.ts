// The month in hand, for words that tell a month the simulation stamped as months away
// (docs/rules/world.md R-WORLD-002). The game store sets it whenever the view changes and the
// provider clears it when the game leaves the screen; with no game around it is null, and a
// stamped month keeps its number.
let current: number | null = null;

/** Sets the month in hand: the view's `month`, or null when there is no view. */
export function setNow(month: number | null): void {
  current = month;
}

/** The month in hand, or null when no game is on screen. */
export function nowMonth(): number | null {
  return current;
}
