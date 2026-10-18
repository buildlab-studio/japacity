// The routes list's words (docs/rules/world.md R-WORLD-006), read from content's ui/ui.routes.text.ts.
import { say, type Params } from "../../shared/words/text";

/** Words for a routes key. */
export function routesWords(key: string, params: Params = {}): string {
  return say(key, params);
}
