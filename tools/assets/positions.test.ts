// Positions and geometry (city:positions-not-for-geometry): a place's position lays out the map and is checked, and no model is built from
// it; only a landmark's traced outline comes from open map data, and then the credits carry it.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

import { defaultPaths, mapSources } from "./assets-check";
import { filesUnder, readJson, REPO_ROOT } from "../repo";

const paths = defaultPaths(REPO_ROOT);

/** Every source file under `dir`, tests left out. */
function sourcesUnder(dir: string): string[] {
  return filesUnder(dir)
    .filter((file) => /\.(ts|js|mjs)$/.test(file) && !/\.test\.ts$/.test(file))
    .map((file) => join(dir, file));
}

/** A place's position as the content carries it: `latE3` and `lonE3`. */
const POSITION = /\b(latE3|lonE3)\b/;

describe("positions are not geometry", () => {
  test("[city:positions-not-for-geometry] given every builder of the kit and the asset tools, when their code is read, then none reads a place's latitude or longitude", () => {
    const builders = [...sourcesUnder(join(REPO_ROOT, "models")), ...sourcesUnder(join(REPO_ROOT, "packages", "assets", "src")), ...sourcesUnder(join(REPO_ROOT, "tools", "assets"))];
    expect(builders.length).toBeGreaterThan(20);
    expect(builders.filter((file) => POSITION.test(readFileSync(file, "utf8"))).map((file) => relative(REPO_ROOT, file))).toEqual([]);
  });

  test("[city:positions-not-for-geometry] given every outline taken from OpenStreetMap, when the shipped credits are read, then each outline's map source is credited there", () => {
    const outlines = mapSources(paths, []);
    expect(outlines.length).toBeGreaterThan(0);
    const credits = readJson<{ mapData: { sources: string[] }[] }>(join(paths.public, "credits.json"));
    const credited = new Set(credits.mapData.flatMap((line) => line.sources));
    expect(outlines.filter((source) => !credited.has(source))).toEqual([]);
  });
});
