import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, test } from "vitest";

import { boxBounds, footprintOf, inBox, inPolygon, isFootprint, isWalkable, lowBox, onWalkable, placeFootprint, setFootprint } from "./footprint";

function block(group: Group, width: number, height: number, depth: number, x: number, y: number, z: number): void {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), new MeshBasicMaterial());
  mesh.position.set(x, y + height / 2, z);
  group.add(mesh);
}

describe("footprints", () => {
  test("[R-ASSET-030] given a footprint of boxes or none, when it is read, then boxes with a size and none pass, and an empty list, a box of no size or anything else fails", () => {
    expect(isFootprint("none")).toBe(true);
    expect(isFootprint([{ x: 0, z: 0, width: 1, depth: 2 }])).toBe(true);
    expect(isFootprint([{ x: 0, z: 0, width: 1, depth: 2, turn: 0.5 }])).toBe(true);
    expect(isFootprint([])).toBe(false);
    expect(isFootprint([{ x: 0, z: 0, width: 0, depth: 2 }])).toBe(false);
    expect(isFootprint([{ x: 0, z: 0, width: 1 }])).toBe(false);
    expect(isFootprint(undefined)).toBe(false);
    expect(isFootprint("all")).toBe(false);
  });

  test("[R-ASSET-030] given a builder's group, when its footprint is set, then the loader's copy finds it on the root under the scene", () => {
    const root = setFootprint(new Group(), [{ x: 1, z: 2, width: 3, depth: 4 }]);
    const scene = new Group();
    scene.add(root);
    expect(footprintOf(scene)).toEqual([{ x: 1, z: 2, width: 3, depth: 4 }]);
    expect(footprintOf(new Group())).toBeNull();
  });

  test("[R-ASSET-030] given a prop with a table under head height and an umbrella over it, when its low box is taken, then the umbrella is left out", () => {
    const stall = new Group();
    block(stall, 2, 0.8, 1, 0, 0, 0);
    block(stall, 3, 0.1, 3, 0, 2.2, 0);
    expect(lowBox(stall)).toEqual({ x: 0, z: 0, width: 2, depth: 1 });
  });

  test("[R-ASSET-030] given a box placed with a quarter turn, when points are tested, then it blocks across the turned sides, and grown it blocks a band round them", () => {
    const [box] = placeFootprint([{ x: 1, z: 0, width: 4, depth: 1 }], [10, 10, Math.PI / 2]);
    if (box === undefined) throw new Error("no box");
    // A quarter turn about +Y takes the model's +x to the place's -z.
    expect(box.x).toBeCloseTo(10);
    expect(box.z).toBeCloseTo(9);
    expect(inBox(box, 10, 7.1)).toBe(true);
    expect(inBox(box, 10, 6.9)).toBe(false);
    expect(inBox(box, 10.6, 9)).toBe(false);
    expect(inBox(box, 10.6, 9, 0.3)).toBe(true);
    const [minX, minZ, maxX, maxZ] = boxBounds(box, 0.3);
    expect(minX).toBeCloseTo(9.2);
    expect(maxX).toBeCloseTo(10.8);
    expect(minZ).toBeCloseTo(6.7);
    expect(maxZ).toBeCloseTo(11.3);
    expect(placeFootprint("none", [0, 0, 0])).toEqual([]);
  });

  test("[R-ASSET-030] given walkable polygons, when points are tested, then inside one is walkable, outside all is not, and a polygon needs three corners", () => {
    const square: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];
    const notch: [number, number][] = [[10, 0], [14, 0], [14, 4], [12, 2], [10, 4]];
    expect(inPolygon(square, 2, 2)).toBe(true);
    expect(inPolygon(square, 5, 2)).toBe(false);
    expect(inPolygon(notch, 12, 3)).toBe(false);
    expect(inPolygon(notch, 12, 1)).toBe(true);
    expect(onWalkable([square, notch], 13, 1)).toBe(true);
    expect(onWalkable([square, notch], 8, 1)).toBe(false);
    expect(isWalkable([square])).toBe(true);
    expect(isWalkable([])).toBe(false);
    expect(isWalkable([[[0, 0], [1, 1]]])).toBe(false);
  });
});
