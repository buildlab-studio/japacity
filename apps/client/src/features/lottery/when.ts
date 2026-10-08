// The draw's times as words: the wait to the close and the close itself in
// the player's own time zone.
import { say } from "../../shared/words/text";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A wait as days, hours and minutes, coarsest first: "2 d 4 h", "3 h 05 min", "12 min". */
export function waitWords(ms: number): string {
  if (ms < MINUTE_MS) return say("ui.clock.under-minute");
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  if (days > 0) return say("ui.lottery.days", { days, hours });
  return hours > 0 ? say("ui.clock.hours", { hours, minutes: String(minutes).padStart(2, "0") }) : say("ui.clock.minutes", { minutes });
}

const CLOSE_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The close in the player's own time zone: "Friday 9 Oct, 19:00". */
export function closeWords(at: number): string {
  return CLOSE_FORMAT.format(new Date(at)).replace(/ at /, ", ");
}
