// The draw's times as words: the wait to the close and the close itself in
// the player's own time zone.
import { say, sayCount } from "../../shared/words/text";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A wait in whole words, coarsest two parts first: "1 day 6 hours", "3 hours 5 minutes", "12 minutes". */
export function waitWords(ms: number): string {
  if (ms < MINUTE_MS) return say("ui.lottery.wait.under-minute");
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const part = (unit: "days" | "hours" | "minutes", count: number) => sayCount(`ui.lottery.wait.${unit}`, count, { count });
  if (days > 0) return hours > 0 ? `${part("days", days)} ${part("hours", hours)}` : part("days", days);
  if (hours > 0) return minutes > 0 ? `${part("hours", hours)} ${part("minutes", minutes)}` : part("hours", hours);
  return part("minutes", minutes);
}

const CLOSE_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The close in the player's own time zone: "Friday 9 Oct, 19:00". */
export function closeWords(at: number): string {
  return CLOSE_FORMAT.format(new Date(at)).replace(/ at /, ", ");
}
