// The words of each country abroad fetched in a chunk of its own (engine:first-download-has-budget; world:painted-maps-abroad,
// world:ride-abroad-and-workplace) and added to the late table once the life is in that country: London's, Calgary's, Dubai's and Castel
// Volturno's, each content's ui/ui.<city>.text.ts. The imports sit with the city's other chunks, so the first visit's
// shared words carry only the late table's few lines (shared/words/late.ts).
import { addLateWords } from "../../shared/words/late";

const loading = new Map<string, Promise<void>>();

/** Each country's table, fetched by a dynamic import so it rides a chunk of its own. */
const TABLES: Readonly<Record<string, () => Promise<Readonly<Record<string, string>>>>> = {
  "country.uk": () => import("@japacity/content/ui/london").then((table) => table.uiLondonText),
  "country.canada": () => import("@japacity/content/ui/calgary").then((table) => table.uiCalgaryText),
  "country.uae": () => import("@japacity/content/ui/dubai").then((table) => table.uiDubaiText),
  "country.italy": () => import("@japacity/content/ui/castel").then((table) => table.uiCastelText),
};

/** Whether a country abroad has words of its own to fetch. */
export function hasAbroadWords(country: string | null): boolean {
  return country !== null && TABLES[country] !== undefined;
}

/** The country's words, fetched once, then added so every lookup finds them; nothing for a country with none. */
export function loadAbroadWords(country: string | null): Promise<void> {
  const table = country === null ? undefined : TABLES[country];
  if (country === null || table === undefined) return Promise.resolve();
  const known = loading.get(country);
  if (known !== undefined) return known;
  const load = table().then((words) => addLateWords(words));
  loading.set(country, load);
  return load;
}
