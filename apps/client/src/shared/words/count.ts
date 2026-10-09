// Counts as a person says them (docs/rules/text.md R-TEXT-005): words up to ten, figures above.
import { formatNumber } from "./format";
import { hasWords, say } from "./text";

/** "one", "two", ... "ten", then "11". */
export function countWords(count: number): string {
  return hasWords(`ui.count.${String(count)}`) ? say(`ui.count.${String(count)}`) : formatNumber(count);
}

/**
 * The Month sheet's line while working, with what is planned beside the job:
 * "Working, and one thing planned beside the job", never "1 of 1 things planned".
 */
export function workingPlanned(used: number): string {
  return say(used === 1 ? "ui.month.working-things.one" : "ui.month.working-things", { count: countWords(used) });
}
