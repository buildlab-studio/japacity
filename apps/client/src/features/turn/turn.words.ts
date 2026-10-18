// The month's words in the world (docs/rules/world.md R-WORLD-007, 008): the Calendar app and the results, read
// from content's ui/ui.turn.text.ts.
import { text } from "@japacity/content";

import { hasWords, say } from "../../shared/words/text";

/** Words for a turn key: content's, else a country's late words. */
export function turnWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? say(key) : undefined) ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
