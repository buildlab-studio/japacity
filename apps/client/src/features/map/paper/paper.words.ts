// Each painted city's own words (decision 0026; docs/rules/world.md R-WORLD-038, R-WORLD-039): its districts, its
// cards, its water and any inset. A city's own line is read first, then the map's words.
import { mapWords } from "../map.words";

/** London's own words: its districts, its cards, its river and Heathrow's inset. */
export const londonMapText: Record<string, string> = {
  "map.area.peckham": "Peckham",
  "map.area.camberwell": "Camberwell",
  "map.area.nunhead": "Nunhead",
  "map.area.old-kent-road": "Old Kent Road",
  "map.area.elephant": "Elephant and Castle",
  "map.area.london-bridge": "London Bridge",
  "map.area.city": "The City",
  "map.water.thames": "The Thames",
  "map.card.elephant": "Elephant and London Bridge",
  "map.card.old-kent-road": "Old Kent Road",
  "map.card.camberwell": "Camberwell",
  "map.card.peckham": "Peckham",
  "map.card.nunhead": "Nunhead",
  "map.inset.heathrow": "Heathrow",
  "map.inset.west": "Far west, by train",
};

/** Calgary's own words: its districts, its cards and its river. */
export const calgaryMapText: Record<string, string> = {
  "map.area.calgary.whitehorn": "Whitehorn",
  "map.area.calgary.rundle": "Rundle",
  "map.area.calgary.sunridge": "Sunridge",
  "map.area.calgary.airport": "The airport",
  "map.area.calgary.downtown": "Downtown",
  "map.water.bow": "The Bow",
  "map.card.airport": "The airport",
  "map.card.north-east": "The north-east",
  "map.card.downtown": "Downtown",
};

/** Dubai's own words: its districts, its cards and its water. */
export const dubaiMapText: Record<string, string> = {
  "map.area.dubai.deira": "Deira",
  "map.area.dubai.bur-dubai": "Bur Dubai",
  "map.area.dubai.garhoud": "Al Garhoud",
  "map.area.dubai.qusais": "Al Qusais",
  "map.area.dubai.business-bay": "Business Bay",
  "map.water.creek": "Dubai Creek",
  "map.water.gulf": "The Gulf",
  "map.card.deira": "Deira",
  "map.card.airport": "The airport",
  "map.card.camp": "The camp",
  "map.card.site": "The site",
};

/** The coast's own words: its districts, its cards, its sea and river, and Naples' inset. */
export const castelMapText: Record<string, string> = {
  "map.area.castel.town": "Castel Volturno",
  "map.area.castel.pinetamare": "Pinetamare",
  "map.area.castel.fields": "The fields",
  "map.area.castel.varcaturo": "Varcaturo",
  "map.water.tyrrhenian": "The sea",
  "map.water.volturno": "The Volturno",
  "map.card.town": "The town",
  "map.card.fields": "The fields",
  "map.card.domitiana": "The Domitiana",
  "map.inset.naples": "Naples",
  "map.inset.inland": "Inland, by bus",
};

/** A city's own words for a key, with its params; the map's words for a key the city has none for. */
function paperWords(own: Readonly<Record<string, string>>, key: string, params: Record<string, string | number>): string {
  const line = own[key];
  if (line === undefined) return mapWords(key, params);
  return line.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

export function londonMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(londonMapText, key, params);
}

export function calgaryMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(calgaryMapText, key, params);
}

export function dubaiMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(dubaiMapText, key, params);
}

export function castelMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(castelMapText, key, params);
}
