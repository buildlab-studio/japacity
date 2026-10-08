import { content as realContent } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { goldens } from "../goldens";
import { goldenScripts } from "../goldens/scripts";
import { miniContent } from "../testing/miniContent";
import { standInWorld } from "../world/standIn";
import type { Content } from "./types";
import { measure } from "./golden";
import { lifeStart, loadSave } from "./replay";

/** The content a save's version names, as tools/bless.ts has it. */
const CONTENTS: Record<string, Content> = { [miniContent.version]: miniContent, [realContent.version]: realContent };

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
      const version = loadSave(golden.save).segments[0]!.content;
      const content = CONTENTS[version];
      if (content === undefined) throw new Error(`No content ${version} for the golden ${golden.name}.`);
      const worldSeed = lifeStart(golden.save)!.worldSeed;
      const measured = measure(golden.save, content, (tick) => standInWorld(worldSeed, tick, content));
      expect(measured.months).toEqual(golden.months);
      expect(measured.finalHash).toBe(golden.finalHash);
    },
  );
});
