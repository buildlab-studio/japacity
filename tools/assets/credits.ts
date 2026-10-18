// pnpm assets:credits: writes public/assets/credits.json for the credits screen (city.md R-CITY-021)
// from the register and the map data, so the check can prove the two agree.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultPaths, expectedCredits, mapSources } from "./assets-check";
import { placeMapData } from "./map-data";
import { readRegister } from "./register";

function main(): void {
  const paths = defaultPaths(join(import.meta.dirname, "..", ".."));
  const credits = expectedCredits(readRegister(), mapSources(paths, placeMapData()));
  writeFileSync(join(paths.public, "credits.json"), `${JSON.stringify(credits, null, 2)}\n`);
  console.log(`credits: ${String(credits.mapData.length)} map data line(s), ${String(credits.assets.length)} attribution(s), ${String(credits.fonts.length)} font(s)`);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) main();
