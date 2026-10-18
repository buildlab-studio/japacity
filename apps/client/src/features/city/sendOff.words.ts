// The send-off scene's words (docs/rules/chapter.md R-CHAPTER-012, world.md R-WORLD-037): content's text first, then the
// scene's own table (content's ui/ui.sendOff.text.ts), which rides the scene's chunk, then a country's late words.
import { text } from "@japacity/content";
import { uiSendOffText } from "@japacity/content/ui/send-off";

import { hasWords, words } from "../../shared/words/text";

/** A key of the scene's words, content's table first. Counts take the `.one` form at one. */
export function sendOffWords(key: string, params: Record<string, string | number> = {}): string {
  const counted = typeof params.count === "number" && params.count === 1 && (text[`${key}.one`] !== undefined || uiSendOffText[`${key}.one`] !== undefined) ? `${key}.one` : key;
  const template = text[counted] ?? uiSendOffText[counted] ?? (hasWords(counted) ? words(counted) : undefined) ?? counted;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (params[name] === undefined ? whole : String(params[name])));
}
