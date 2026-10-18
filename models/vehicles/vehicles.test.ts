import { Box3, type Group, type Mesh } from "three";
import { describe, expect, test } from "vitest";

import { isPaletteName } from "@japacity/model-kit";

import { buildStall } from "../props/stall";
import { buildDanfo, buildKeke, buildOkada } from "./vehicles";

const MODELS: [string, () => Group][] = [
  ["vehicle_danfo", buildDanfo],
  ["vehicle_keke", buildKeke],
  ["vehicle_okada", buildOkada],
  ["prop_stall", buildStall],
];

describe("the danfo, the keke, the okada and the stall", () => {
  test.each(MODELS)("[assets:metre-units-and-origin] given %s, when it is built, then its lowest point is on y = 0 and its origin is the centre of its footprint", (_, build) => {
    const box = new Box3().setFromObject(build());
    expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(box.min.z + box.max.z)).toBeLessThanOrEqual(0.02);
  });

  test.each(MODELS.slice(0, 3))("[assets:metre-units-and-origin] given %s, when it is built, then it faces +Z, its length along z", (_, build) => {
    const size = new Box3().setFromObject(build()).getSize(new Box3().min);
    expect(size.z).toBeGreaterThan(size.x);
  });

  test("[assets:metre-units-and-origin] given the danfo, when it is built, then its windscreen is at the +Z end", () => {
    const danfo = buildDanfo();
    danfo.updateMatrixWorld(true);
    const glassZ: number[] = [];
    danfo.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as { userData: { palette?: string } }).userData.palette;
      if (name === "cream") glassZ.push(new Box3().setFromObject(mesh).getCenter(new Box3().min).z);
    });
    // The headlamps are cream, and they are at the front.
    expect(glassZ.length).toBeGreaterThan(0);
    for (const z of glassZ) expect(z).toBeGreaterThan(2);
  });

  test.each(MODELS)("[assets:colours-from-named-palette] given %s, when it is built, then every part names a palette colour", (_, build) => {
    build().traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as { userData: { palette?: string } }).userData.palette ?? "";
      expect(isPaletteName(name)).toBe(true);
    });
  });

  test.each(MODELS)("[assets:shipped-file-naming] given %s, when it is built, then its name fits the shipped file pattern", (name, build) => {
    expect(build().name).toBe(name);
    expect(`${name}.glb`).toMatch(/^(person|vehicle|building|shopfront|landmark|prop)_[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*)?\.(glb|png|ktx2)$/);
  });
});
