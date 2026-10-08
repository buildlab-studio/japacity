// Talk overheard in a place (city.md R-CITY-003): the place's own lines from content, and talk of
// news already delivered and routes already heard, all read from the view. Chosen from the place's
// id, the day and how many lines have been heard there today; it never makes a route heard.
import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { hash } from "./crowd";

export interface Heard {
  /** A words key: the place's own line, or the city's line about a story or a route. */
  key: string;
  params: Record<string, string>;
}

/** `<place>.overheard.1`, `.2` and on, while content has words for them. */
export function placeLines(place: string): string[] {
  const keys: string[] = [];
  for (let n = 1; text[`${place}.overheard.${String(n)}`] !== undefined; n += 1) keys.push(`${place}.overheard.${String(n)}`);
  return keys;
}

/** Everything that may be overheard here today, from the view only. */
export function heardHere(view: Pick<PlayerView, "news" | "routes">, place: string): Heard[] {
  return [
    ...placeLines(place).map((key) => ({ key, params: {} })),
    ...view.news.map((story) => ({ key: "city.overheard.news", params: { head: `${story.id}.${story.stage}.head` } })),
    ...view.routes.filter((route) => route.state !== "unknown").map((route) => ({ key: "city.overheard.route", params: { route: route.id } })),
  ];
}

/** The `nth` line heard in a place on a day, or null when there is nothing to hear. */
export function overheard(view: Pick<PlayerView, "news" | "routes">, place: string, date: string, nth: number): Heard | null {
  const lines = heardHere(view, place);
  return lines.length === 0 ? null : (lines[hash(`${place}|${date}|overheard|${String(nth)}`) % lines.length] ?? null);
}
