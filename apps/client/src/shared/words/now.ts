// The month in hand, for words that tell a month the simulation stamped as months away
// (docs/rules/world.md R-WORLD-002). The game store sets it whenever the view changes and the
// provider clears it when the game leaves the screen; with no game around it is null, and a
// stamped month keeps its number. Beside it, where the life on screen is from (prologue.md
// R-PROLOGUE-002), which fills `{hometown}` in content's lines; and the names a computer person
// goes by in this life, where the player's own first name is theirs (R-PROLOGUE-009, R-PEOPLE-061, amended 11 Oct
// 2026; worked out in `authority/others.ts`, so the name pool stays out of the words every screen loads).
let current: number | null = null;
let hometown: string | null = null;

/** For a text key, each name it says and the name it says instead. */
export type NameSwaps = ReadonlyMap<string, readonly (readonly [string, string])[]>;

const NONE: NameSwaps = new Map();
let swaps: NameSwaps = NONE;

/**
 * Sets the month in hand, where the life is from and the names said otherwise: the view's `month` and `hometown` and the
 * swaps for the player's name, or none when there is no view.
 */
export function setNow(month: number | null, from: string | null = null, names: NameSwaps = NONE): void {
  current = month;
  hometown = from;
  swaps = names;
}

function escaped(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A line of content's with the names it says otherwise for the life on screen said so; any other line as it is. */
export function swapped(key: string, line: string): string {
  const pairs = swaps.get(key);
  return pairs === undefined ? line : pairs.reduce((said, [from, to]) => said.replace(new RegExp(`\\b${escaped(from)}\\b`, "g"), to), line);
}

/** The month in hand, or null when no game is on screen. */
export function nowMonth(): number | null {
  return current;
}

/** Where the life on screen is from, `hometown.<slug>`, or null when no game is on screen or its family is not drawn yet. */
export function nowHometown(): string | null {
  return hometown;
}
