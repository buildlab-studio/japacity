// Counts as a person says them (text:bands-not-figures): words up to ten, figures above.
import { formatNumber } from "./format";
import { hasWords, say } from "./text";

/** "one", "two", ... "ten", then "11". */
export function countWords(count: number): string {
  return hasWords(`ui.count.${String(count)}`) ? say(`ui.count.${String(count)}`) : formatNumber(count);
}
