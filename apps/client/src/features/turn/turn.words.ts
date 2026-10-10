// The month's own words in the world (docs/rules/world.md R-WORLD-007, 008): the Month sheet and the
// results. First drafts in the voice of docs/rules/text.md. Content's table wins over these, so each
// key can move into content to be rewritten.
import { text } from "@japacity/content";

import { hasWords, say } from "../../shared/words/text";

export const turnText: Record<string, string> = {
  "turn.month.label": "Month {month}",
  "turn.month.title": "This month",
  "turn.month.free": "Free time",
  "turn.month.working": "Working: {job}",
  "turn.month.side": "Side job: {job}",
  "turn.month.working-rest": "Working. Nothing else planned.",
  "turn.month.working-slots": "Working. {used} of {slots} things planned beside the job",
  "turn.month.hint": "Tap a thing or a person in the world to plan it",
  "turn.month.remove": "Take out {activity}",
  "turn.month.no-slots": "No free time this month.",
  "turn.month.no-slot": "Takes no slot",
  "turn.month.end": "Next month",
  // R-HOME-010: the room's year falls due at this month's end and is not held.
  "turn.month.rent-short": "Rent {amount} due this month. You hold {held}.",

  "turn.results.label": "The month is done",
  "turn.results.title": "The month is done",
  "turn.results.birthday": "You turned {years} this month.",
  "turn.results.kept": "Kept this month",
  "turn.results.lost": "Down this month",
  "turn.results.nothing-moved": "Nothing moved",
  "turn.results.story": "This month",
  "turn.results.money": "In and out",
  "turn.results.no-money": "No money came in or went out.",
  "turn.results.draw": "Draw {draw}",
  "turn.results.draw-matched": "One of yours came in",
  "turn.results.savings": "Saved for the move",
  "turn.results.savings-line": "{shown} of {required}",
  "turn.results.ready": "Ready to move",
  "turn.results.news": "The rest of the month's news is on your phone, in News.",
  "turn.results.back": "Back to {place}",
  "turn.results.quiet": "The quiet months",
  "turn.results.quiet-kept": "Kept {amount}.",
  "turn.results.quiet-down": "Down {amount}.",
  "turn.results.quiet-still": "Nothing else moved.",
  "turn.results.quiet-none": "Nothing moved.",
  "turn.results.stopped": "Then this month",
};

/** Words for a turn key: content's first, then the interface's, then these drafts. */
export function turnWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? say(key) : undefined) ?? turnText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
