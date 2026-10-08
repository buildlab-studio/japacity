// Which version of a report line the screen shows.
import { versionedLines } from "./comedy.data";

/**
 * When the plain line must be shown whatever the draw: on the road (the view's
 * place says so), while the character is broke (as offer.md counts it), and in a
 * month whose report carries bad news (`reportPlain` in comedy.check.ts).
 */
export interface PlainOnly {
  onRoad: boolean;
  broke: boolean;
  badNews: boolean;
}

/** The number of versions a line has, the plain one included. */
export function versionCount(key: string): number {
  return versionedLines[key] ?? 1;
}

/**
 * The text key to show for a line, from a whole number the caller draws once and
 * keeps for that line (so a month read again reads the same): 0 is the plain line.
 * Bad news never has versions (the check in comedy.test.ts), so it is always plain.
 */
export function versionKey(key: string, draw: number, plainOnly: PlainOnly): string {
  if (plainOnly.onRoad || plainOnly.broke || plainOnly.badNews) return key;
  const index = Math.abs(draw) % versionCount(key);
  return index === 0 ? key : `${key}.v${String(index + 1)}`;
}
