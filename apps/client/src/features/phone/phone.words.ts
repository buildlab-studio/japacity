// The phone's words (docs/rules/world.md R-WORLD-018, 019), read from content's ui/ui.phone.text.ts.
import { say, type Params } from "../../shared/words/text";

/** Words for a phone key. */
export function phoneWords(key: string, params: Params = {}): string {
  return say(key, params);
}
