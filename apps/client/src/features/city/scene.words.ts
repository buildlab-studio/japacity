// The scene's own words (docs/rules/world.md R-WORLD-005): the names of things and their acts, in the
// voice of docs/rules/text.md. Content's table wins over these, then the interface's
// and the city's, so each key can move into content.
import { text } from "@japacity/content";

import { hasWords } from "../../shared/words/text";
import { cityWords } from "./city.words";

export const sceneText: Record<string, string> = {
  "scene.thing.house": "The house",
  "scene.thing.door": "The door",
  "scene.act.play-lotto": "Buy a ticket",
  "scene.act.bet-slip": "Place a bet",
  "scene.act.enter": "Go in",
  "scene.act.out": "Step outside",
};

/** Words for a scene key: content's first, then the interface's, then the scene's own drafts, then the city's. */
export function sceneWords(key: string, params: Record<string, string | number> = {}): string {
  const own = sceneText[key];
  if (own === undefined || text[key] !== undefined || hasWords(key)) return cityWords(key, params);
  return own.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
