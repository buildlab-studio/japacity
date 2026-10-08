// The city's own words, first drafts in the voice of docs/rules/text.md. Content's table wins over
// these, so each key can move into content to be rewritten. Place names, blurbs, signs and
// talk overheard are content's already (city.md R-CITY-024).
import { text } from "@japacity/content";

import { hasWords, nameOf, runningName, words } from "../../shared/words/text";
import { hash } from "./crowd";
import type { Role } from "./roster";

export const cityText: Record<string, string> = {
  "city.menu": "City",
  "city.look": "Look around",
  "city.back": "Back to your month",
  "city.places": "Places",
  "city.places.title": "Where you can go",
  "city.here": "You are here",
  "city.loading": "Getting {place} ready: {percent}%",
  "city.failed": "{place} could not be shown. Your month is not affected.",
  "city.unbuilt": "Not built yet: open ground for now.",
  "city.band.quiet": "Quiet",
  "city.band.busy": "Busy",
  "city.band.packed": "Packed",
  "city.hold": "Tap the ground to walk. Hold to look from above.",
  "city.close": "Close",
  "city.you": "You",

  "city.map": "Map",
  "city.map.country": "Country",
  "city.map.home": "Home",
  "city.map.been": "Been here",
  "city.map.can": "Can go",
  "city.map.not": "Not yet",
  "city.map.line.here": "You are here. {things} things to do.",
  "city.map.line.things": "{things} things to do here.",
  "city.map.line.not": "Not yet. Opens when a route takes you through here.",
  "city.map.go": "Go there",
  "city.map.go-home": "Go home",
  "city.map.locked": "Locked",
  "city.map.not-now": "Not now",
  "city.map.hint": "Drag to look round. Pinch to zoom. Tap a pin.",
  "city.map.lagos": "Lagos",
  "city.map.no-visa": "No visa yet",
  "city.map.not-open": "Not in this life yet",
  "city.hud.month": "Month {month}",
  "city.world.tap": "Tap a thing to do it. Tap the ground to walk.",

  "city.graphics": "Graphics",
  "city.graphics.auto": "Let the game choose",
  "city.graphics.low": "Low: lighter on the phone",
  "city.graphics.high": "High: shadows, haze, more people",
  "city.graphics.now": "Showing: {mode}",
  "city.mode.low": "low",
  "city.mode.high": "high",

  "city.card.resident": "{name}, {role}. Lives in the city.",
  "city.card.player": "{name}. Another player.",
  "city.card.stranger": "Another player.",
  "city.card.shop": "{sign}",
  "city.role.passer-by": "passing through",
  "city.role.hawker": "hawker",
  "city.role.rider": "okada rider",
  "city.role.corper": "serving corps member",
  "city.role.trader": "trader",
  "city.role.elder": "elder of the area",

  "city.overheard.news": "“Did you hear? {head}”",
  "city.overheard.route": "“My cousin's friend went by {route}. It is not easy, they say.”",

  "city.scene.at": "At {place}",
  "city.scene.answer": "Answer in your month",
  "city.report.here": "This month, here",
  "city.offer.here": "Waiting for you here: {offer}",

  "city.credits": "Credits",
  "city.credits.map": "Map data",
  "city.credits.fonts": "Fonts",
  "city.credits.assets": "Models",
  "city.credits.generated": "Generated media",
  "city.credits.loading": "Reading the credits...",
};

/** First names for the people who live in the city. Common names, no one in particular. */
export const RESIDENT_NAMES: Record<"f" | "m", readonly string[]> = {
  f: ["Bisi", "Nkechi", "Aisha", "Funke", "Ngozi", "Halima", "Yetunde", "Chioma", "Kemi", "Amina", "Titi", "Ifeoma"],
  m: ["Tunde", "Emeka", "Musa", "Segun", "Chinedu", "Sani", "Kunle", "Obinna", "Femi", "Ibrahim", "Dapo", "Uche"],
};

/** How a name is said in the street, by age and sex: Iya Bisi, Baba Tunde, or the name alone. */
export const RESIDENT_TITLES: Record<"f" | "m", readonly string[]> = {
  f: ["Iya", "Mama", "Aunty", ""],
  m: ["Baba", "Oga", "Brother", ""],
};

export function roleWords(role: Role): string {
  return cityWords(`city.role.${role}`);
}

/** Words for a city key: content's first, then the interface's, then the city's own drafts. */
export function cityWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? words(key) : undefined) ?? cityText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** A place's name as content gives it (R-CITY-024). */
export function placeName(id: string): string {
  return nameOf(id);
}

/** A line overheard, as words: the place's own line, or talk of a story or a route the view holds. */
export function heardWords(key: string, params: Record<string, string>): string {
  if (key === "city.overheard.news") return cityWords(key, { head: words(params.head ?? "") });
  if (key === "city.overheard.route") return cityWords(key, { route: runningName(params.route ?? "") });
  return text[key] ?? key;
}

/** What a resident is called, from the same hash as the crowd: the same person has the same name all day. */
export function residentName(sex: "f" | "m", place: string, date: string, slot: number): string {
  const names = RESIDENT_NAMES[sex];
  const titles = RESIDENT_TITLES[sex];
  const name = names[hash(`${place}|${date}|${String(slot)}|name`) % names.length] ?? "";
  const title = titles[hash(`${place}|${date}|${String(slot)}|title`) % titles.length] ?? "";
  return title === "" ? name : `${title} ${name}`;
}
