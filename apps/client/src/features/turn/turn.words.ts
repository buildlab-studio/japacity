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
  // What carries on into next month until it is stopped, and a month held by a burial or a stay in hospital (R-WORLD-007).
  "turn.calendar.carrying": "Carrying on",
  "turn.calendar.all-used": "Free time: all used",
  "turn.calendar.left": "Free time: {count} left",
  "turn.calendar.done": "Done this month",
  "turn.calendar.chores.cook": "Cooked: {amount} less this month",
  "turn.calendar.chores.water": "Fetched water: {amount} less this month",
  "turn.calendar.chores.both": "Cooked and fetched water: {amount} less this month",
  "turn.calendar.chores.cooked": "Cooked for the week",
  "turn.calendar.chores.drum": "The drum is full",
  // The month's bus pass (place.md R-PLACE-012): the bus asks nothing until the month ends.
  "turn.calendar.pass": "Bus pass bought: the bus is free till the month ends",
  "turn.calendar.at": "At {place}",
  // Where a dated ask is attended when no place of the city stages it (R-WORLD-002).
  "turn.calendar.where.offer.village-burial": "In the village",
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
  // The month the Friday draw's result comes, a player who held tickets in it and won nothing is told so (lottery.md
  // R-LOTTERY-016).
  "turn.results.draw-missed": "Your tickets did not win.",
  "turn.results.draw-missed.one": "Your ticket did not win.",
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
