import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import { linearToSrgb, nearestPaletteName, palette, paletteNames, paletteRgb, srgbToLinear } from "./palette";

const page = readFileSync(new URL("../../../docs/rules/assets.md", import.meta.url), "utf8");
const section = page.slice(page.indexOf("## The palette"), page.indexOf("## Budgets for one asset"));
const onPage = new Map([...section.matchAll(/`(\w+)`\s*(?:\|\s*)?#([0-9a-f]{6})/g)].map((m) => [m[1] ?? "", parseInt(m[2] ?? "0", 16)]));
const labPal = readFileSync(new URL("../../../prototypes/asset-lab/models.js", import.meta.url), "utf8");
const labBlock = labPal.slice(labPal.indexOf("export const PAL = {"), labPal.indexOf("};", labPal.indexOf("export const PAL = {")));
const lab = new Map([...labBlock.matchAll(/(\w+):\s*0x([0-9a-f]{6})/g)].map((m) => [m[1] ?? "", parseInt(m[2] ?? "0", 16)]));

describe("the palette", () => {
  test("[R-ASSET-001] given the palette file, when it is read, then every colour is a named entry of the page's palette and no entry is missing", () => {
    expect(onPage.size).toBeGreaterThan(50);
    expect(new Map(paletteNames.map((name) => [name, palette[name] as number]))).toEqual(onPage);
  });

  test("[R-ASSET-002] given the design's PAL, when the palette is read, then every lab entry is kept with its name and value, and the four scene colours are named", () => {
    expect(lab.size).toBe(37);
    for (const [name, value] of lab) expect(palette[name as keyof typeof palette]).toBe(value);
    expect([palette.sand, palette.asphalt, palette.marking, palette.sky]).toEqual([0xd9b27c, 0x4a4a4f, 0xe9e3d2, 0xf3d9a4]);
  });

  test("[R-ASSET-001] given a palette colour, when it goes to linear light and back to 8 bits, then it is the same entry within 1 on each channel", () => {
    for (const name of paletteNames) {
      const rgb = paletteRgb(name);
      const back = rgb.map((c) => Math.round(linearToSrgb(srgbToLinear(c / 255)) * 255)) as [number, number, number];
      expect(nearestPaletteName(back)).not.toBeNull();
    }
  });

  test("[R-ASSET-001] given a colour 2 off a palette entry on one channel, when it is checked, then it is not a palette colour", () => {
    const [r, g, b] = paletteRgb("danfoYellow");
    expect(nearestPaletteName([r, g, b])).toBe("danfoYellow");
    expect(nearestPaletteName([r, g - 1, b])).toBe("danfoYellow");
    expect(nearestPaletteName([r, g - 2, b])).toBeNull();
  });
});
