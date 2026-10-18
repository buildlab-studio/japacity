// What the scene's tests read: every built place's file as the client sees it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PlaceFile } from "./placeFile";

const PLACES = join(import.meta.dirname, "..", "..", "..", "public", "assets", "places");

/** Every place file shipped under public/assets/places, by its folder; a folder of shared models only has none. */
export function builtPlaces(): { folder: string; file: PlaceFile }[] {
  return readdirSync(PLACES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(PLACES, entry.name, "place.json")))
    .map((entry) => ({ folder: entry.name, file: JSON.parse(readFileSync(join(PLACES, entry.name, "place.json"), "utf8")) as PlaceFile }));
}
