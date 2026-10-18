// The map's words, read from content's ui/ui.map.text.ts, and the ride's working numbers (docs/rules/world.md
// R-WORLD-015 to 017).
import { text } from "@japacity/content";

import { hasWords, words } from "../../shared/words/text";
import type { RideChoice } from "../../shared/world/contract";

/** Words for a map key: content's, else a country's late words. */
export function mapWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? words(key) : undefined) ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The ways of Lagos in the order the sheet lists them: cheapest first. */
export const WAYS: readonly Exclude<RideChoice["id"], "drive" | "bus" | "train" | "taxi">[] = ["danfo", "keke", "okada", "walk"];
