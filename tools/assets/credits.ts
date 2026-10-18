// pnpm assets:credits: writes public/assets/credits.json for the credits screen (city:credits-screen-attributions)
// from the register and the map data, so the check can prove the two agree.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultPaths, expectedCredits, mapSources } from "./assets-check";
import { placeMapData } from "./map-data";
import { readRegister } from "./register";
import { isMain, REPO_ROOT } from "../repo";

function main(): void {
  const paths = defaultPaths(REPO_ROOT);
  const credits = expectedCredits(readRegister(), mapSources(paths, placeMapData()));
  writeFileSync(join(paths.public, "credits.json"), `${JSON.stringify(credits, null, 2)}\n`);
  console.log(`credits: ${String(credits.mapData.length)} map data line(s), ${String(credits.assets.length)} attribution(s), ${String(credits.fonts.length)} font(s)`);
}

if (isMain(import.meta.url)) main();
