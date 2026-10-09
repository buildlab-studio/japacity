// The agent's sheet's own words (docs/rules/advice.md R-ADVICE-005, 006), first drafts in the voice
// of docs/rules/text.md. Content's table wins over these, so each key can move into content for the
// lead to rewrite. The agent's line, his tells, his looks and his choices are content's already.
import { text } from "@japacity/content";

import { hasWords, say } from "../../shared/words/text";

export const adviceUiText: Record<string, string> = {
  "advice.notice": "You notice",
  "advice.looks": "Look before you pay",
  "advice.looks.free": "Free. No slot.",
  "advice.look.done": "Done",
  "advice.look.nobody": "You know nobody to ask yet.",
  "advice.says": "What he says you need",
  "advice.says.sure": "Only the official page at the hub's desk is sure.",
  "advice.short": "His fee would take the last of your money.",
  "advice.promise.month": "The card says: {when}",
  "advice.gone": "He has gone.",
};

/** Words for an advice key: content's first, then the interface's, then the sheet's own drafts. */
export function adviceWords(key: string, params: Parameters<typeof say>[1] = {}): string {
  if (text[key] !== undefined || hasWords(key)) return say(key, params);
  const template = adviceUiText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || typeof value === "object" ? whole : String(value);
  });
}
