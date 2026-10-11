// The month's own words in the world (docs/rules/world.md R-WORLD-007, 008): the Calendar app and the
// results. First drafts in the voice of docs/rules/text.md. Content's table wins over these, so each
// key can move into content to be rewritten.
import { text } from "@japacity/content";

import { countWords } from "../../shared/words/count";
import { hasWords, say } from "../../shared/words/text";

export const turnText: Record<string, string> = {
  "turn.month.label": "Month {month}",
  "turn.month.title": "This month",
  "turn.month.free": "Free time",
  "turn.month.working": "Working: {job}",
  "turn.month.side": "Side job: {job}",
  "turn.month.hint": "Tap a thing in the world to start something. It carries on each month until you stop it.",
  "turn.month.no-slots": "No free time this month.",
  "turn.month.end": "Next month",
  // The Calendar app (R-WORLD-002, R-WORLD-007): the month on the phone, in order.
  "turn.calendar.work": "Work",
  "turn.calendar.all-used": "Free time: all used",
  "turn.calendar.left": "Free time: {count} left",
  "turn.calendar.done": "Done this month",
  "turn.calendar.chores.cook": "Cooked: {amount} less this month",
  "turn.calendar.chores.water": "Fetched water: {amount} less this month",
  "turn.calendar.chores.both": "Cooked and fetched water: {amount} less this month",
  "turn.calendar.chores.cooked": "Cooked for the week",
  "turn.calendar.chores.drum": "The drum is full",
  "turn.calendar.at": "At {place}",
  // Where a dated ask is attended when no place of the city stages it (R-WORLD-002).
  "turn.calendar.where.offer.village-burial": "In the village",
  "turn.calendar.pages": "Pages left",
  // Said once in a life, when Next month opens the Calendar instead of turning the page (R-WORLD-002).
  "turn.calendar.teach": "This is your month before the page turns. What you start carries on each month until you stop it.",
  "turn.calendar.teach.ok": "Got it",
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

/**
 * The free time in a few words (R-WORLD-007, R-TURN-006), as Next month's second line says it: an empty month rests,
 * a full one says so; never a count of slots.
 */
export function freeTimeWords(used: number, slots: number): string {
  if (slots === 0) return turnWords("turn.month.no-slots");
  if (used === 0) return say("ui.month.rest");
  if (used >= slots) return turnWords("turn.calendar.all-used");
  return turnWords("turn.calendar.left", { count: countWords(slots - used) });
}
