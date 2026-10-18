// The scene's words (docs/rules/world.md R-WORLD-005): the names of things and their acts, read from content's
// ui/ui.scene.text.ts as the city's words are.
import { cityWords } from "./city.words";

/** Words for a scene key. */
export function sceneWords(key: string, params: Record<string, string | number> = {}): string {
  return cityWords(key, params);
}
