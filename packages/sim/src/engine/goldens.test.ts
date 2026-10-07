import { describe, expect, test } from "vitest";

import { goldens } from "../goldens";
import { goldenScripts } from "../goldens/scripts";
import { miniContent } from "../testing/miniContent";
import { standInWorld } from "../world/standIn";
import { measure } from "./golden";

describe("golden replays", () => {
  test("[R-ENGINE-010] given the golden scripts, when compared with the blessed files, then every script has a golden and no golden is stale", () => {
    expect(goldens.map((golden) => golden.name).sort()).toEqual(goldenScripts.map((script) => script.name).sort());
    for (const script of goldenScripts) {
      expect(goldens.find((golden) => golden.name === script.name)?.save).toEqual(script.save);
    }
  });

  test.each(goldens.map((golden) => [golden.name, golden] as const))(
    "[R-ENGINE-001] [R-ENGINE-010] given the golden %s, when its save is replayed, then every month's figures and the final hash match",
    (_name, golden) => {
      expect(golden.save.content).toBe(miniContent.version);
      const measured = measure(golden.save, miniContent, (tick) => standInWorld(golden.save.worldSeed, tick, miniContent));
      expect(measured.months).toEqual(golden.months);
      expect(measured.finalHash).toBe(golden.finalHash);
    },
  );
});
