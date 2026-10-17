// The words of each country abroad fetched in a chunk of its own (engine.md R-ENGINE-020; world.md R-WORLD-038,
// R-WORLD-039) and added to the late table once the life is in that country: London's through its
// own loader, Calgary's, Dubai's and Castel Volturno's here. The imports sit with the city's other chunks, so the first
// visit's shared words carry only the late table's few lines (shared/words/late.ts).
import { addLateWords } from "../../shared/words/late";
import { loadLondonWords } from "./londonWords";

const loading = new Map<string, Promise<void>>();

/** Each country's table, fetched by a dynamic import so it rides a chunk of its own. */
const TABLES: Readonly<Record<string, () => Promise<Readonly<Record<string, string>>>>> = {
  "country.canada": () => import("../../shared/words/calgary.words").then((table) => table.calgaryWords),
  "country.uae": () => import("../../shared/words/dubai.words").then((table) => table.dubaiWords),
  "country.italy": () => import("../../shared/words/castel.words").then((table) => table.castelWords),
};

/** Whether a country abroad has words of its own to fetch. */
export function hasAbroadWords(country: string | null): boolean {
  return country === "country.uk" || (country !== null && TABLES[country] !== undefined);
}

/** The country's words, fetched once, then added so every lookup finds them; nothing for a country with none. */
export function loadAbroadWords(country: string | null): Promise<void> {
  if (country === "country.uk") return loadLondonWords();
  const table = country === null ? undefined : TABLES[country];
  if (country === null || table === undefined) return Promise.resolve();
  const known = loading.get(country);
  if (known !== undefined) return known;
  const load = table().then((words) => addLateWords(words));
  loading.set(country, load);
  return load;
}
