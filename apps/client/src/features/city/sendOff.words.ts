// The send-off scene's words (docs/rules/chapter.md R-CHAPTER-012, world.md R-WORLD-037): content's text first, then the
// scene's own table (content's ui/ui.sendOff.text.ts), which rides the scene's chunk, then a country's late words.
import { text } from "@japacity/content";
import { uiSendOffText } from "@japacity/content/ui/send-off";

import { type Filled, readerOf } from "../../shared/words/text";

const read = readerOf(uiSendOffText);

/** A key of the scene's words, content's table first. Counts take the `.one` form at one. */
export function sendOffWords(key: string, params: Filled = {}): string {
  const counted = typeof params.count === "number" && params.count === 1 && (text[`${key}.one`] !== undefined || uiSendOffText[`${key}.one`] !== undefined) ? `${key}.one` : key;
  return read(counted, params);
}
