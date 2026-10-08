import { Color, type MeshLambertMaterial } from "three";
import { describe, expect, test } from "vitest";

import { puffGeometry, smoke } from "./motion";
import { PUFF_INDEX, PUFF_POSITIONS } from "./puff.data";

describe("smoke", () => {
  test("[R-ASSET-005] given the smoke, when it is built, then each puff is the blended shape from the build, its corners shared and its material smooth, not a faceted ball", () => {
    const puffs = smoke(20, [new Color(0xffffff)]);
    const material = puffs.material as MeshLambertMaterial;
    expect(material.flatShading).toBe(false);
    expect(material.transparent).toBe(false);
    expect(puffs.geometry.getIndex()?.count).toBe(PUFF_INDEX.length);
    expect(puffs.geometry.getAttribute("position").count).toBe(PUFF_POSITIONS.length / 3);
    expect(puffs.geometry.getAttribute("normal").count).toBe(PUFF_POSITIONS.length / 3);
  });

  test("[R-CITY-026] given the smoke, when it is built, then it is one instanced draw call whose copies each carry a seed, so the shader alone moves and shrinks them", () => {
    const puffs = smoke(30, [new Color(0xffffff), new Color(0x808080)]);
    expect(puffs.count).toBe(30);
    expect(puffs.geometry.getAttribute("aSeed").count).toBe(30);
    expect(puffGeometry().index?.count).toBe(PUFF_INDEX.length);
  });
});
