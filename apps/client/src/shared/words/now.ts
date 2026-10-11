// The month in hand, for words that tell a month the simulation stamped as months away
// (docs/rules/world.md R-WORLD-002). The game store sets it whenever the view changes and the
// provider clears it when the game leaves the screen; with no game around it is null, and a
// stamped month keeps its number. Beside it, where the life on screen is from (prologue.md
// R-PROLOGUE-002), which fills `{hometown}` in content's lines.
let current: number | null = null;
let hometown: string | null = null;

/** Sets the month in hand and where the life is from: the view's `month` and `hometown`, or nulls when there is no view. */
export function setNow(month: number | null, from: string | null = null): void {
  current = month;
  hometown = from;
}

/** The month in hand, or null when no game is on screen. */
export function nowMonth(): number | null {
  return current;
}

/** Where the life on screen is from, `hometown.<slug>`, or null when no game is on screen or its family is not drawn yet. */
export function nowHometown(): string | null {
  return hometown;
}
