// London's words ride a chunk of their own (engine.md R-ENGINE-020; world.md R-WORLD-038, R-WORLD-039): no module of the
// game imports their table but the loader, by a dynamic import, and once added every lookup finds them.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { loadAbroadWords } from "./abroad.words";
import { sources, SRC } from "./abroad.words.testing";
import { hasWords, words } from "../../shared/words/text";

describe("words a first visit does not carry", () => {
  test("[R-ENGINE-020] [R-WORLD-039] given London's words, when the game's modules are read, then only the loader names their table, and by a dynamic import", () => {
    const naming = sources(SRC).filter((path) => readFileSync(path, "utf8").includes("london.words"));
    expect(naming.map((path) => path.slice(SRC.length + 1))).toEqual(["features/city/abroad.words.ts"]);
    expect(readFileSync(join(SRC, "features", "city", "abroad.words.ts"), "utf8")).toMatch(/import\("\.\.\/\.\.\/shared\/words\/tables\/london\.words"\)/);
  });

  test("[R-ENGINE-020] [R-WORLD-039] given a London key, when it is read before its table is loaded and after, then it shows as itself first and in words once loaded", async () => {
    expect(hasWords("city.thing.ticket-machine")).toBe(false);
    expect(words("city.thing.ticket-machine")).toBe("city.thing.ticket-machine");
    await loadAbroadWords("country.uk");
    expect(hasWords("city.thing.ticket-machine")).toBe(true);
    expect(words("city.thing.ticket-machine")).toBe("Ticket machine");
  });
});
