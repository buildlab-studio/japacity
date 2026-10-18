// Each painted city's own words (decision 0026; docs/rules/world.md R-WORLD-038, R-WORLD-039): its districts, its
// cards, its water and any inset, from content's ui/ui.paper.text.ts. A city's own line is read first, then the map's words.
import { uiCalgaryMapText, uiCastelMapText, uiDubaiMapText, uiLondonMapText } from "@japacity/content/ui/paper";

import { mapWords } from "../map.words";

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
  return paperWords(uiLondonMapText, key, params);
}

export function calgaryMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(uiCalgaryMapText, key, params);
}

export function dubaiMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(uiDubaiMapText, key, params);
}

export function castelMapWords(key: string, params: Record<string, string | number> = {}): string {
  return paperWords(uiCastelMapText, key, params);
}
