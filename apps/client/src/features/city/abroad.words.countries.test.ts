// Calgary's, Dubai's and Castel Volturno's words ride a chunk each (engine.md R-ENGINE-020; world.md R-WORLD-038,
// R-WORLD-039): no module of the game imports their tables but the loader, by a dynamic import, and once a
// country's table is added every lookup finds its words.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { hasAbroadWords, loadAbroadWords } from "./abroad.words";
import { sources, SRC } from "./abroad.words.testing";
import { hasWords, words } from "../../shared/words/text";

describe("the three countries' words a first visit does not carry", () => {
  test.each(["calgary", "dubai", "castel"])("[R-ENGINE-020] [R-WORLD-039] given %s's words, when the game's modules are read, then only the loader names their table, and by a dynamic import", (name) => {
    const naming = sources(SRC).filter((path) => readFileSync(path, "utf8").includes(`${name}.words`));
    expect(naming.map((path) => path.slice(SRC.length + 1))).toEqual(["features/city/abroad.words.ts"]);
    expect(readFileSync(join(SRC, "features", "city", "abroad.words.ts"), "utf8")).toContain(`import("../../shared/words/tables/${name}.words")`);
  });

  test("[R-ENGINE-020] [R-WORLD-039] given a key of each country, when it is read before its table is loaded and after, then it shows as itself first and in words once the country's table is in; a country with none loads nothing", async () => {
    const keys: [string, string, string][] = [
      ["country.canada", "map.ride.line.ctrain.1", "Doors closing. Please stand clear."],
      ["country.uae", "city.thing.nol-machine", "Nol machine"],
      ["country.italy", "city.thing.gangmaster-table", "Gangmaster's table"],
    ];
    for (const [country, key, said] of keys) {
      expect([country, hasWords(key)]).toEqual([country, false]);
      expect(hasAbroadWords(country)).toBe(true);
      await loadAbroadWords(country);
      expect([country, words(key)]).toEqual([country, said]);
    }
    expect(hasAbroadWords(null)).toBe(false);
    await expect(loadAbroadWords("country.nowhere")).resolves.toBeUndefined();
  });
});
