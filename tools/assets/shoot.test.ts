import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { CATALOG, ROOT, SOURCE } from "./catalog";
import { PHONE_SHOT } from "./shoot";

const config = JSON.parse(readFileSync(join(SOURCE, "review.config.json"), "utf8")) as { phoneShot: Record<string, number>; criteria: { key: string }[] };
const stage = readFileSync(join(SOURCE, "stage", "stage.ts"), "utf8");

describe("the fixed views", () => {
  test("[R-ASSET-020] given every asset, when its views are listed, then it gets the four elevations, the three-quarter view and the phone shot, and buildings and landmarks the plan", () => {
    for (const entry of CATALOG) expect(entry.views).toEqual(expect.arrayContaining(["front", "back", "left", "right", "threeQuarter", "phone"]));
    const planned = CATALOG.filter((entry) => /^(bld|lm|shop)_/.test(entry.name));
    expect(planned.filter((entry) => !entry.views.includes("plan")).map((entry) => entry.name)).toEqual([]);
  });

  test("[R-ASSET-020] given the phone shot, when its numbers are read, then it is 360 by 640 CSS pixels at device scale 2 and 12 m, as the review sheet's numbers say", () => {
    expect(PHONE_SHOT).toEqual({ width: 360, height: 640, deviceScaleFactor: 2, distance: 12 });
    expect(config.phoneShot).toMatchObject({ width: 360, height: 640, deviceScaleFactor: 2, distanceMetres: 12, lensDegrees: 32 });
    expect(stage).toMatch(/camera\.position\.set\(centreX, 1\.6, front \+ 12\)/);
  });

  test("[R-ASSET-020] given the shooter, when it launches a browser, then it uses Playwright's own Chromium with no hard-coded path, on the software renderer", () => {
    const sources = readdirSync(join(ROOT, "tools", "assets")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => readFileSync(join(ROOT, "tools", "assets", f), "utf8"));
    expect(sources.join("\n")).not.toMatch(/executablePath\s*:/);
    expect(sources.join("\n")).toMatch(/--use-angle=swiftshader/);
  });

  test("[R-ASSET-006] given the stage, when its lights are counted, then there is one sun and one sky and nothing else", () => {
    expect(stage.match(/new DirectionalLight\(/g)).toHaveLength(1);
    expect(stage.match(/new HemisphereLight\(/g)).toHaveLength(1);
    expect(stage).not.toMatch(/new (AmbientLight|PointLight|SpotLight|RectAreaLight)\(/);
  });

  test("[R-ASSET-021] given the review sheet, when its criteria are read, then they are the Review shape's seven scores, budget scored by the check", () => {
    expect(config.criteria.map((c) => c.key)).toEqual(["phone", "silhouette", "proportion", "palette", "wear", "variety", "budget"]);
  });

  test("[R-ASSET-021] given the examples sheet, when it is read, then it names the six examples the catalog ships, with their round-two totals and the bars 21, 21 and 20 of 35", () => {
    const examples = JSON.parse(readFileSync(join(SOURCE, "examples.json"), "utf8")) as { bar: Record<string, number>; examples: { name: string; file: string; roundTwo: Record<string, number>; roundTwoTotal: number }[] };
    expect(examples.examples.map((e) => e.name).sort()).toEqual(CATALOG.filter((e) => e.example === true).map((e) => e.name).sort());
    for (const e of examples.examples) {
      expect(Object.values(e.roundTwo).reduce((a, b) => a + b, 0)).toBe(e.roundTwoTotal);
      expect(CATALOG.find((c) => c.name === e.name)?.file).toBe(e.file);
    }
    expect([examples.bar.building, examples.bar.shopfront, examples.bar.landmark, examples.bar.outOf]).toEqual([21, 21, 20, 35]);
  });
});
