// The street's things of decision 0037 (docs/rules/streets.md R-STREET-011): the suya grill, the barber's kiosk,
// the viewing centre and the joint's chairs, each a model the player taps, built in Node and measured as the
// export measures it, inside its prefix's budget, palette only, standing on y = 0 with its footprint.
import budgets from "../../assets-src/budgets.json";
import { describe, expect, test } from "vitest";

import { CATALOG } from "./catalog";
import { measure, readGlb, toDocument, writeGlb } from "./glb";
import { checkPalette } from "./palette-check";

const STREET_THINGS = [
  { name: "prop_suya-grill", file: "shared/prop/prop_suya-grill.glb", place: "shared", signs: 0 },
  { name: "prop_joint-set", file: "shared/prop/prop_joint-set.glb", place: "shared", signs: 0 },
  { name: "shop_barber-kiosk", file: "places/bode-thomas/shop_barber-kiosk.glb", place: "place.bode-thomas", signs: 1 },
  { name: "shop_viewing-centre", file: "places/bode-thomas/shop_viewing-centre.glb", place: "place.bode-thomas", signs: 0 },
] as const;

function entry(name: string) {
  const found = CATALOG.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`${name} is not catalogued`);
  return found;
}

describe("the street's things", () => {
  test.each(STREET_THINGS)("[R-ASSET-007] [R-ASSET-001] [R-ASSET-003] given $name, when it is built, baked and compressed, then it is inside its prefix's budget, palette only, on y = 0 and inside its height", async ({ name, file, place }) => {
    const found = entry(name);
    expect({ file: found.file, place: found.place }).toEqual({ file, place });
    const bytes = await writeGlb(toDocument(found.build()));
    const doc = await readGlb(bytes);
    const figures = measure(doc, bytes.byteLength);
    const prefix = name.split("_")[0] as "prop" | "shop";
    const budget = budgets.asset[prefix];
    expect(figures.triangles).toBeLessThanOrEqual(budget.triangles);
    expect(figures.drawCalls).toBeLessThanOrEqual(budget.drawCalls);
    expect(figures.materials).toBeLessThanOrEqual(budget.materials);
    expect(figures.bytes).toBeLessThanOrEqual(budget.bytes);
    expect(checkPalette(doc)).toEqual([]);
    expect(Math.abs(figures.minY)).toBeLessThanOrEqual(0.01);
    if (prefix === "shop") {
      expect(figures.maxY).toBeGreaterThanOrEqual(budgets.asset.shop.heightMin);
      expect(figures.maxY).toBeLessThanOrEqual(budgets.asset.shop.heightMax);
    }
  });

  test.each(STREET_THINGS)("[R-ASSET-030] [R-ASSET-012] given $name, when it is built, then it records the ground it blocks and carries its lettered boards as anchors with text keys, never as words", ({ name, signs }) => {
    const model = entry(name).build();
    const footprint = model.extras.footprint;
    expect(Array.isArray(footprint)).toBe(true);
    expect((footprint as unknown[]).length).toBeGreaterThan(0);
    const anchors = (model.extras.signs ?? []) as { key: string }[];
    expect(anchors).toHaveLength(signs);
    for (const anchor of anchors) expect(anchor.key).toMatch(/^place\.bode-thomas\.sign\.[0-9]+$/);
  });

  test("[R-ASSET-003] given the barber's kiosk and the viewing centre, when they are built, then the kiosk is about three metres tall and the shed about three point two", async () => {
    for (const [name, height] of [["shop_barber-kiosk", 3.0], ["shop_viewing-centre", 3.2]] as const) {
      const bytes = await writeGlb(toDocument(entry(name).build()));
      const figures = measure(await readGlb(bytes), bytes.byteLength);
      expect(Math.abs(figures.maxY - height), name).toBeLessThanOrEqual(0.5);
    }
  });
});
