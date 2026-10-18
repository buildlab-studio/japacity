// Positions and geometry (city.md R-CITY-009): a place's position lays out the map and is checked, and no model is built from
// it; only a landmark's traced outline comes from open map data, and then the credits carry it.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

import { defaultPaths, mapSources } from "./check-assets";

const ROOT = join(import.meta.dirname, "..", "..");
const paths = defaultPaths(ROOT);

/** Every source file under `dir`, tests left out. */
function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|js|mjs)$/.test(file) && !/\.test\.ts$/.test(file) && !file.includes("node_modules"))
    .map((file) => join(dir, file));
}

/** A place's position as the content carries it: `latE3` and `lonE3`. */
const POSITION = /\b(latE3|lonE3)\b/;

describe("positions are not geometry", () => {
  test("[R-CITY-009] given every builder of the kit and the asset tools, when their code is read, then none reads a place's latitude or longitude", () => {
    const builders = [...sourcesUnder(join(ROOT, "assets-src")), ...sourcesUnder(join(ROOT, "packages", "assets", "src")), ...sourcesUnder(join(ROOT, "tools", "assets"))];
    expect(builders.length).toBeGreaterThan(20);
    expect(builders.filter((file) => POSITION.test(readFileSync(file, "utf8"))).map((file) => relative(ROOT, file))).toEqual([]);
  });

  test("[R-CITY-009] given every outline taken from OpenStreetMap, when the shipped credits are read, then each outline's map source is credited there", () => {
    const outlines = mapSources(paths, []);
    expect(outlines.length).toBeGreaterThan(0);
    const credits = JSON.parse(readFileSync(join(paths.public, "credits.json"), "utf8")) as { mapData: { sources: string[] }[] };
    const credited = new Set(credits.mapData.flatMap((line) => line.sources));
    expect(outlines.filter((source) => !credited.has(source))).toEqual([]);
  });
});
