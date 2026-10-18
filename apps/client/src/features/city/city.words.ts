// The city's words, read from content's ui/ui.city.text.ts and, for place names, blurbs, signs and talk overheard,
// place/place.text.ts (city.md R-CITY-024); and the names of the people who live in the city.
import { text } from "@japacity/content";

import { nameOf, readerOf, runningName, words } from "../../shared/words/text";
import { hash } from "../../shared/scene/crowd";
import type { Role } from "../../shared/scene/roster";

/** First names for the people who live in the city. Common names, no one in particular. */
const RESIDENT_NAMES: Record<"f" | "m", readonly string[]> = {
  f: ["Bisi", "Nkechi", "Aisha", "Funke", "Ngozi", "Halima", "Yetunde", "Chioma", "Kemi", "Amina", "Titi", "Ifeoma"],
  m: ["Tunde", "Emeka", "Musa", "Segun", "Chinedu", "Sani", "Kunle", "Obinna", "Femi", "Ibrahim", "Dapo", "Uche"],
};

/** How a name is said in the street, by age and sex: Iya Bisi, Baba Tunde, or the name alone. */
const RESIDENT_TITLES: Record<"f" | "m", readonly string[]> = {
  f: ["Iya", "Mama", "Aunty", ""],
  m: ["Baba", "Oga", "Brother", ""],
};

export function roleWords(role: Role): string {
  return cityWords(`city.role.${role}`);
}

/** Words for a city key: content's, else a country's late words. */
export const cityWords = readerOf();

/** A place's name as content gives it (R-CITY-024). */
export function placeName(id: string): string {
  return nameOf(id);
}

/** A line overheard, as words: the place's own line, or talk of a story or a route the view holds. */
export function heardWords(key: string, params: Record<string, string>): string {
  // A headline that is itself someone's words keeps them, without its own straight quotes: the bubble's curly ones hold the line.
  if (key === "city.overheard.news") return cityWords(key, { head: words(params.head ?? "").replace(/^"(.*)"$/, "$1").replaceAll('"', "") });
  if (key === "city.overheard.route") return cityWords(key, { route: runningName(params.route ?? "") });
  return text[key] ?? cityWords(key);
}

/** What a resident is called, from the same hash as the crowd: the same person has the same name all day. */
export function residentName(sex: "f" | "m", place: string, date: string, slot: number): string {
  const names = RESIDENT_NAMES[sex];
  const titles = RESIDENT_TITLES[sex];
  const name = names[hash(`${place}|${date}|${String(slot)}|name`) % names.length] ?? "";
  const title = titles[hash(`${place}|${date}|${String(slot)}|title`) % titles.length] ?? "";
  return title === "" ? name : `${title} ${name}`;
}
