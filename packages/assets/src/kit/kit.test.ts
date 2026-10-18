import { Box3, Group, type Mesh, type MeshStandardMaterial } from "three";
import { describe, expect, test } from "vitest";

import type { BuildingSpec } from "../types";
import { BUILDING_HEIGHT_MAX, buildBuilding } from "./building";
import { dishDirection, KIT_SIZES, stairFlight, wornShade } from "./parts";
import { layoutStreet, sameLook } from "./street";

const plaza: BuildingSpec = { footprint: [12.8, 8], storeys: 3, roof: "flat", wall: "wallPeach", wear: 2, balconies: 2, stairs: "side", gate: true, clutterSeed: 11, signs: ["a.sign.1", "a.sign.2", "a.sign.3", "a.sign.4"] };
const street = layoutStreet(2026, 60);

function meshes(g: Group): Mesh[] {
  const out: Mesh[] = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}
const colourOf = (m: Mesh): string => ((m.material as MeshStandardMaterial).userData as { palette: string }).palette;
const triangles = (g: Group): number => meshes(g).reduce((sum, m) => sum + (m.geometry.index?.count ?? m.geometry.getAttribute("position").count) / 3, 0);
const positions = (g: Group): number[] => meshes(g).flatMap((m) => [...m.geometry.getAttribute("position").array, ...m.matrixWorld.elements]);

describe("the kit's sizes", () => {
  test("[assets:people-and-door-sizes] given the kit, when its doors and windows are read, then a door is 2.1 by 0.9, a double door 2.1 by 1.2, a window 1.2 square with its sill at 0.9", () => {
    expect(KIT_SIZES.door).toEqual({ width: 0.9, doubleWidth: 1.2, height: 2.1 });
    expect(KIT_SIZES.window).toEqual({ size: 1.2, sill: 0.9 });
  });

  test("[assets:buildings-assembled-from-kit] given the kit, when its part sizes are read, then each is the part table's", () => {
    expect([KIT_SIZES.wall, KIT_SIZES.storey, KIT_SIZES.slab]).toEqual([0.23, 3.0, 0.15]);
    expect(KIT_SIZES.parapet).toEqual({ height: 1.0, thickness: 0.15, coping: 0.05 });
    expect([KIT_SIZES.roof.pitchMinDeg, KIT_SIZES.roof.pitchMaxDeg, KIT_SIZES.roof.eaves]).toEqual([20, 30, 0.6]);
    expect([KIT_SIZES.balcony.depthMin, KIT_SIZES.balcony.depthMax, KIT_SIZES.balcony.rail]).toEqual([1.2, 1.5, 1.0]);
    expect(KIT_SIZES.stairs).toEqual({ rise: 0.17, going: 0.27, widthMin: 1.0, widthMax: 1.2, maxRisers: 12 });
    expect(KIT_SIZES.gate).toEqual({ widthMin: 3.0, widthMax: 3.6, heightMin: 2.1, heightMax: 2.4, doorWidth: 0.9, doorHeight: 2.1 });
    expect(KIT_SIZES.fence).toEqual({ height: 2.4, thickness: 0.15 });
    expect([KIT_SIZES.tank.smallAcross, KIT_SIZES.tank.smallHigh, KIT_SIZES.tank.largeAcross, KIT_SIZES.tank.largeHigh, KIT_SIZES.tank.standMin, KIT_SIZES.tank.standMax]).toEqual([1.2, 1.0, 1.4, 1.4, 3, 6]);
    expect([KIT_SIZES.generator.small, KIT_SIZES.generator.large]).toEqual([[0.6, 0.45, 0.45], [2.0, 1.3, 1.0]]);
    expect(KIT_SIZES.dish.across).toBeGreaterThanOrEqual(0.8);
    expect(KIT_SIZES.dish.across).toBeLessThanOrEqual(0.9);
    expect([KIT_SIZES.fascia.heightMin, KIT_SIZES.fascia.heightMax]).toEqual([0.6, 0.9]);
    expect(KIT_SIZES.poleSign).toEqual({ width: 1.2, height: 0.8, bottom: 2.4 });
    expect([KIT_SIZES.awning.depthMin, KIT_SIZES.awning.depthMax, KIT_SIZES.awning.edgeMin]).toEqual([1.0, 1.5, 2.2]);
    expect([KIT_SIZES.bay.widthMin, KIT_SIZES.bay.widthMax, KIT_SIZES.bay.shutterBox]).toEqual([3.0, 4.0, 0.3]);
    expect(KIT_SIZES.drain).toEqual({ width: 0.45, depth: 0.6 });
    expect(KIT_SIZES.pole).toEqual({ height: 9, spanMin: 30, spanMax: 40 });
  });

  test("[assets:buildings-assembled-from-kit] given a flight of 12 risers and one of 13, when they are built, then 12 is a flight and 13 needs a landing", () => {
    expect(() => stairFlight(new Group(), 0, 0, 0, 12, 0.17, 1.1, 0, "concrete")).not.toThrow();
    expect(() => stairFlight(new Group(), 0, 0, 0, 13, 0.17, 1.1, 0, "concrete")).toThrow(/more than a flight/);
  });

  test("[assets:buildings-assembled-from-kit] given shop bays of 3.0 and 4.0 m and of 2.9 m, when the building is built, then 3.0 to 4.0 are allowed and 2.9 is refused", () => {
    expect(() => buildBuilding({ ...plaza, footprint: [12, 8] })).not.toThrow();
    expect(() => buildBuilding({ ...plaza, footprint: [16, 8] })).not.toThrow();
    expect(() => buildBuilding({ ...plaza, footprint: [11.6, 8] })).toThrow(/outside 3.0 to 4.0/);
  });
});

describe("a building is data", () => {
  test("[assets:metre-units-and-origin] given a building, when it is built, then its lowest point is y = 0 within 0.01 m, its footprint is centred on the origin and its signs face +z", () => {
    const g = buildBuilding(plaza);
    const box = new Box3().setFromObject(g);
    expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);
    const body = meshes(g).filter((m) => colourOf(m) === plaza.wall && m.geometry.type === "BoxGeometry").map((m) => new Box3().setFromObject(m)).sort((a, b) => b.max.y - b.min.y - (a.max.y - a.min.y))[0];
    expect(body?.min.x).toBeCloseTo(-6.4, 5);
    expect(body?.max.z).toBeCloseTo(4, 5);
    for (const sign of g.userData.signs as { ry: number; centre: number[] }[]) {
      expect(sign.ry).toBeCloseTo(0, 6);
      expect(sign.centre[2]).toBeGreaterThan(4);
    }
  });

  test("[assets:variants-are-numbers-not-code] given a spec read back from JSON, when it is built, then the building is the same: a building is numbers given to the kit, not new code", () => {
    const again = JSON.parse(JSON.stringify(plaza)) as BuildingSpec;
    expect(positions(buildBuilding(again))).toEqual(positions(buildBuilding(plaza)));
  });

  test("[assets:buildings-assembled-from-kit] given storeys of 3.0 m over a 3.6 m shop floor on a 0.3 m step, when it is built, then the body rises to 9.9 m and the parapet to 10.9 m", () => {
    const g = buildBuilding(plaza);
    expect(g.userData.top).toBeCloseTo(10.9, 6);
  });

  test("[assets:buildings-assembled-from-kit] given a building with shops, when it is built, then each sign is a text key on an anchor and its board is 0.6 to 0.9 high", () => {
    const signs = buildBuilding(plaza).userData.signs as { key: string; height: number }[];
    expect(signs.map((s) => s.key)).toEqual(plaza.signs);
    for (const sign of signs) {
      expect(sign.height).toBeGreaterThanOrEqual(KIT_SIZES.fascia.heightMin);
      expect(sign.height).toBeLessThanOrEqual(KIT_SIZES.fascia.heightMax);
    }
  });
});

describe("wear and clutter", () => {
  test("[assets:buildings-carry-wear-and-clutter] given sixty buildings of a street, when they are built, then each carries at least two of tank, dish, generator, bars, stains, notice and wires", () => {
    for (const spec of street) {
      const clutter = buildBuilding(spec).userData.clutter as string[];
      expect(clutter.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("[assets:buildings-carry-wear-and-clutter] given a painted wall, when it wears, then the wear is its darker named shade, and any other wall wears to worn concrete", () => {
    expect(wornShade("wallCream")).toBe("wallCreamWorn");
    expect(wornShade("wallPeach")).toBe("wallPeachWorn");
    expect(wornShade("wallMint")).toBe("wallMintWorn");
    expect(wornShade("wallSky")).toBe("wallSkyWorn");
    expect(wornShade("concrete")).toBe("concreteWorn");
    const worn = meshes(buildBuilding({ ...plaza, wear: 3 })).filter((m) => colourOf(m) === "wallPeachWorn");
    expect(worn.length).toBeGreaterThanOrEqual(5);
  });
});

describe("a street", () => {
  test("[assets:neighbours-never-identical] given a layout seed, when the street is laid twice, then it is the same street, built the same way", () => {
    expect(layoutStreet(2026, 60)).toEqual(street);
    const first = street[0];
    if (first === undefined) throw new Error("no building");
    expect(positions(buildBuilding(first))).toEqual(positions(buildBuilding(first)));
  });

  test("[assets:neighbours-never-identical] given a street of sixty, when it is laid, then no two neighbours share footprint, storeys, roof and wall colour together", () => {
    const pairs = street.slice(1).map((next, i) => sameLook(street[i] ?? next, next));
    expect(pairs).toHaveLength(59);
    expect(pairs.filter(Boolean)).toEqual([]);
  });

  test("[assets:dishes-face-one-satellite] given every building of a street built with the place's dish direction, when their dishes are read, then they all face the same way", () => {
    const yaw = 1.1;
    const want = dishDirection(yaw);
    for (const spec of street.slice(0, 20)) {
      for (const dir of buildBuilding(spec, { dishYaw: yaw }).userData.dishes as number[][]) {
        dir.forEach((value, axis) => expect(value).toBeCloseTo(want[axis] ?? 0, 6));
      }
    }
  });

  test("[assets:assets-and-places-within-budget] given sixty buildings of a street, when they are built, then each stays inside 1,500 triangles and 13 m", () => {
    for (const spec of street) {
      const g = buildBuilding(spec);
      expect(triangles(g)).toBeLessThanOrEqual(1500);
      expect(new Box3().setFromObject(g).max.y).toBeLessThanOrEqual(BUILDING_HEIGHT_MAX);
    }
  });
});
