// Talk overheard in a place (city:overheard-talk-from-view, world:street-talk-budget): the place's own lines from
// content, and in Lagos the talk of news already delivered and routes already heard, all read from
// the view. Abroad a place says only its own lines, never Lagos rumour. Chosen from the place's id,
// the day and how many lines have been heard there today; it never makes a route heard.
import { content, text } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { hasWords } from "../../shared/words/text";
import { hash } from "../../shared/scene/crowd";

export interface Heard {
  /** A words key: the place's own line, or the city's line about a story or a route. */
  key: string;
  params: Record<string, string>;
  /** The words key naming who says it, where one person plainly does (`<line>.by`, world:street-talk-budget); else nobody named. */
  by?: string;
}

/** A place's own line, with who says it where content names them beside it. */
function ownLine(key: string): Heard {
  const by = `${key}.by`;
  return text[by] === undefined ? { key, params: {} } : { key, params: {}, by };
}

/** `<place>.overheard.1`, `.2` and on, while content has words for them. */
export function placeLines(place: string): string[] {
  const keys: string[] = [];
  for (let n = 1; text[`${place}.overheard.${String(n)}`] !== undefined; n += 1) keys.push(`${place}.overheard.${String(n)}`);
  return keys;
}

/** A place's own short set in the city's words (city.words.ts), beside content's lines: the room abroad's landlord, radiator and neighbour. */
const OWN_SET: Readonly<Record<string, readonly string[]>> = {
  "place.the-room": ["city.overheard.room.1", "city.overheard.room.2", "city.overheard.room.3", "city.overheard.room.4"],
  // London's places, built as Lagos's are (world:ride-abroad-and-workplace; streets:peckham-talks-like-lagos's spirit): content's three lines each and these.
  ...londonSets(["rye-lane", "peckham-rye-station", "big-shop-uk", "care-home-uk", "ward-uk", "office-uk", "warehouse-uk", "church-uk", "test-centre-uk"]),
  // Calgary's, Dubai's and Castel Volturno's places (world:ride-abroad-and-workplace): a line beside content's three where
  // content has them, four of the city's own where it has none, so every place says at least four.
  ...ownSets([
    ["place.calgary-north-east", 1],
    ["place.ctrain-station-canada", 1],
    ["place.big-shop-canada", 4],
    ["place.warehouse-canada", 4],
    ["place.care-home-canada", 4],
    ["place.office-canada", 4],
    ["place.library-canada", 4],
    ["place.church-canada", 4],
    ["place.metro-station-uae", 1],
    ["place.site-uae", 1],
    ["place.big-shop-uae", 4],
    ["place.castel-volturno", 1],
    ["place.via-domitiana", 1],
    ["place.farm-italy", 1],
    ["place.big-shop-italy", 4],
    ["place.church-italy", 4],
  ]),
};

/** `city.overheard.<slug>.1` to `.<count>` for each place `place.<slug>`. */
function ownSets(places: readonly (readonly [string, number])[]): Record<string, readonly string[]> {
  return Object.fromEntries(places.map(([id, count]) => [id, Array.from({ length: count }, (_, index) => `city.overheard.${id.slice("place.".length)}.${String(index + 1)}`)]));
}

/** `city.overheard.<slug>.1` and `.2` for each London place `place.<slug>`. */
function londonSets(slugs: readonly string[]): Record<string, readonly string[]> {
  return Object.fromEntries(slugs.map((slug) => [`place.${slug}`, [`city.overheard.${slug}.1`, `city.overheard.${slug}.2`]]));
}

/** The news and the routes are talked of in Lagos and on the road out; a place abroad, or one content does not know, has only its own lines. */
function hearsLagos(place: string): boolean {
  const where = content.place[place as Id<"place">]?.where;
  return where === "home" || where === "road";
}

/** The family's own lines while home's send-off is open at the house: those, and no rumour. */
function sendOffLines(view: Pick<PlayerView, "offers">, place: string): string[] {
  if (place !== "place.family-house" || !view.offers.some((offer) => offer.entry === "offer.family-send-off")) return [];
  const keys: string[] = [];
  for (let n = 1; hasWords(`place.family-house.send-off.overheard.${String(n)}`); n += 1) keys.push(`place.family-house.send-off.overheard.${String(n)}`);
  return keys;
}

/** Everything that may be overheard here today, from the view only. */
export function heardHere(view: Pick<PlayerView, "news" | "routes"> & Partial<Pick<PlayerView, "offers">>, place: string): Heard[] {
  const sendOff = sendOffLines({ offers: view.offers ?? [] }, place);
  if (sendOff.length > 0) return sendOff.map((key) => ({ key, params: {} }));
  const own = [...placeLines(place), ...(OWN_SET[place] ?? [])].map(ownLine);
  if (!hearsLagos(place)) return own;
  return [
    ...own,
    ...view.news.map((story) => ({ key: "city.overheard.news", params: { head: `${story.id}.${story.stage}.head` } })),
    ...view.routes.filter((route) => route.state !== "unknown").map((route) => ({ key: "city.overheard.route", params: { route: route.id } })),
  ];
}

/**
 * Who says a line, as the bubble names them (world:street-talk-budget): the name content gives beside the line, and the thing of the
 * place that is that person (Mama at the family house) so the words float over them; a line no one is named for has
 * neither, and floats over the resident nearest in the house's or the street's own voice.
 */
export function speakerOf(heard: Pick<Heard, "by">, things: readonly { id: string; label: string }[], said: (key: string) => string): { name?: string; who?: string } {
  if (heard.by === undefined) return {};
  const name = said(heard.by);
  const who = things.find((thing) => said(thing.label) === name)?.id;
  return who === undefined ? { name } : { name, who };
}

/** The `nth` line heard in a place on a day, or null when there is nothing to hear. */
export function overheard(view: Pick<PlayerView, "news" | "routes"> & Partial<Pick<PlayerView, "offers">>, place: string, date: string, nth: number): Heard | null {
  const lines = heardHere(view, place);
  return lines.length === 0 ? null : (lines[hash(`${place}|${date}|overheard|${String(nth)}`) % lines.length] ?? null);
}
