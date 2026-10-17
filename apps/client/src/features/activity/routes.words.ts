// The routes list's own words (docs/rules/world.md R-WORLD-006), in the voice of
// docs/rules/text.md. Content's table wins over these, then the interface's, so each key can move
// into content.
import { text } from "@japacity/content";

import { hasWords, say, type Params } from "../../shared/words/text";

export const routesUiText: Record<string, string> = {
  "routes.pick": "Which way out",
  "routes.pick-first": "Pick one first",
};

/** Words for a routes key: content's first, then the interface's, then the list's own drafts. */
export function routesWords(key: string, params: Params = {}): string {
  if (text[key] !== undefined || hasWords(key)) return say(key, params);
  return routesUiText[key] ?? key;
}
