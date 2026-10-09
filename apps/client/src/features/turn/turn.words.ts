// The month's own words in the world (docs/rules/world.md R-WORLD-007, 008): the Month sheet and the
// results. First drafts in the voice of docs/rules/text.md. Content's table wins over these, so each
// key can move into content to be rewritten.
import { text } from "@japacity/content";

import { hasWords, say } from "../../shared/words/text";

export const turnText: Record<string, string> = {
  "turn.month.label": "Month {month}",
  "turn.month.title": "This month",
  "turn.month.free": "Free. You rest.",
  "turn.month.hint": "Tap something in the world to fill a slot.",
  "turn.month.remove": "Take out {activity}",
  "turn.month.no-slots": "No free slots this month.",
  "turn.month.end": "End month",

  "turn.results.label": "The month is done",
  "turn.results.title": "The month is done",
  "turn.results.birthday": "You turned {years} this month.",
  "turn.results.kept": "Kept this month",
  "turn.results.lost": "Down this month",
  "turn.results.money": "In and out",
  "turn.results.no-money": "No money came in or went out.",
  "turn.results.draw": "Draw {draw}",
  "turn.results.draw-matched": "One of yours came in",
  "turn.results.savings": "Saved for the move",
  "turn.results.savings-line": "{shown} of {required}",
  "turn.results.ready": "Ready to move",
  "turn.results.news": "The rest of the month's news is on your phone, in News.",
  "turn.results.back": "Back to {place}",
};

/** Words for a turn key: content's first, then the interface's, then these drafts. */
export function turnWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? say(key) : undefined) ?? turnText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
