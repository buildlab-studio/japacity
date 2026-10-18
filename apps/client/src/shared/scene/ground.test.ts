import { describe, expect, test } from "vitest";
import type { Mesh, MeshLambertMaterial } from "three";

import { checkFaces, FACE_GAP, stripTops } from "../../../../../tools/assets/faces-check";
import { stageOf } from "./placeFile";
import { builtPlaces } from "./placeFile.testing";
import { groundGeometry, groundOf } from "./world";

describe("faces at one height", () => {
  test("[world:faces-never-share-height] given every built place, when its floor is drawn, then each strip's top stands where the place check reads it, and no strip fights the ground or another strip it overlaps", () => {
    for (const { file } of builtPlaces()) {
      const stage = stageOf(file);
      const tops = stripTops(stage.roads);
      const drawn = new Set<string>();
      const position = groundGeometry(stage).getAttribute("position");
      for (let index = 0; index < position.count; index += 1) drawn.add(position.getY(index).toFixed(4));
      for (const top of tops) expect(drawn.has(top.toFixed(4)), `${file.place}: a strip's top at ${top.toFixed(3)}`).toBe(true);
      expect(checkFaces(file.place, { ...stage, models: [] }, () => []), `${file.place}`).toEqual([]);
      expect(Math.min(...tops.filter((top) => top > 0))).toBeGreaterThanOrEqual(FACE_GAP);
    }
  });

  test("[world:faces-never-share-height] given a place's floor, when it is drawn, then it draws with a depth offset, so a model's floor laid on it wins the pixel", () => {
    const [{ file } = { file: null }] = builtPlaces();
    if (file === null) throw new Error("No place is built");
    const mesh = groundOf(stageOf(file)).children[0] as Mesh;
    const material = mesh.material as MeshLambertMaterial;
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeGreaterThan(0);
    expect(material.polygonOffsetUnits).toBeGreaterThan(0);
  });
});
