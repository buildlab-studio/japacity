// The walls follow the view: each outer side of a wide home stands twice, full
// and knee-high, and the view shows the far pair full and the near pair low for the way it looks, the swap never raising
// a wall in front of the rooms.
import { fullSides, quarterOf, WALL_SIDES, wallNode, wallOf, wallPairs, type WallSide } from "@japacity/model-kit";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { showWalls, WALL_SLACK, wallsOf, wallsQuarter } from "./walls";

/** Each side's outward way in the place's frame (x, z): the back at -z, the left at -x, the front at +z, the right at +x. */
const OUTWARD: Record<WallSide, [number, number]> = { back: [0, -1], left: [-1, 0], front: [0, 1], right: [1, 0] };

/** How much a side faces away from a camera looking along `yaw` degrees: 1 straight ahead, 0 edge on, -1 behind it. */
function away(side: WallSide, yaw: number): number {
  const radians = (yaw * Math.PI) / 180;
  const [x, z] = OUTWARD[side];
  return x * Math.sin(radians) + z * Math.cos(radians);
}

/** A shell as the loader hands it: a mesh per part of every pair, each a box on its side of the house. */
function shell(): { root: Group; meshes: Map<string, Mesh> } {
  const root = new Group();
  const meshes = new Map<string, Mesh>();
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  body.name = "body";
  root.add(body);
  for (const side of WALL_SIDES) {
    for (const state of ["full", "low"] as const) {
      const mesh = new Mesh(new BoxGeometry(OUTWARD[side][0] === 0 ? 10 : 0.2, state === "full" ? 3 : 0.6, OUTWARD[side][1] === 0 ? 10 : 0.2), new MeshBasicMaterial());
      mesh.name = wallNode(side, state);
      mesh.position.set(OUTWARD[side][0] * 5, state === "full" ? 1.5 : 0.3, OUTWARD[side][1] * 5);
      root.add(mesh);
      meshes.set(mesh.name, mesh);
    }
  }
  root.updateMatrixWorld(true);
  return { root, meshes };
}

describe("the walls' pairs", () => {
  test("[world:room-seen-down-its-length] [assets:assets-and-places-within-budget] given a shell's node names, when its pairs are read, then a side with both its full and its knee-high wall is a pair, one alone is none, and any other node is no wall", () => {
    expect(wallOf("wall_back_full")).toEqual({ side: "back", state: "full" });
    expect(wallOf("wall_right_low")).toEqual({ side: "right", state: "low" });
    expect(wallOf("wall_up_full")).toBeNull();
    expect(wallOf("body")).toBeNull();
    expect(wallPairs(WALL_SIDES.flatMap((side) => [wallNode(side, "full"), wallNode(side, "low")]))).toBe(4);
    expect(wallPairs(["body", "wall_back_full", "wall_back_low", "wall_left_full"])).toBe(1);
    expect(wallPairs(["body", "wheels"])).toBe(0);
  });

  test("[world:room-seen-down-its-length] given each quarter a wide home's view rests on, when its pair is read, then the side it looks at and the one on its left stand full, both facing away from the camera or edge on, and the two on the camera's side are knee-high", () => {
    expect(fullSides(0)).toEqual(["front", "right"]);
    expect(fullSides(1)).toEqual(["right", "back"]);
    expect(fullSides(2)).toEqual(["back", "left"]);
    expect(fullSides(3)).toEqual(["left", "front"]);
    for (const quarter of [0, 1, 2, 3]) {
      const yaw = quarter * 90;
      const [ahead, left] = fullSides(quarter);
      expect(away(ahead, yaw)).toBeCloseTo(1, 9);
      expect(away(left, yaw)).toBeCloseTo(0, 9);
      for (const side of WALL_SIDES.filter((one) => one !== ahead && one !== left)) expect(away(side, yaw)).toBeLessThanOrEqual(1e-9);
    }
    // The view down the house's length stands with the back and the left full.
    expect(quarterOf(180)).toBe(2);
    expect(fullSides(quarterOf(180 + 360))).toEqual(["back", "left"]);
  });

  test("[world:room-seen-down-its-length] given the view easing a quarter round either way, when the walls follow it frame by frame, then no wall stands full while it faces the camera by more than the slack a side wall keeps, so a rising wall rises behind the rooms, and at rest the pair is the quarter's", () => {
    const slack = Math.sin((WALL_SLACK * Math.PI) / 180) + 1e-9;
    for (const from of [0, 90, 180, 270]) {
      for (const way of [90, -90]) {
        let shown = quarterOf(from);
        for (let step = 1; step <= 90; step++) {
          const yaw = from + (way * step) / 90;
          const resting = step === 90;
          shown = wallsQuarter(yaw, shown, resting);
          for (const side of fullSides(shown)) expect({ from, way, yaw, side, behind: away(side, yaw) >= -slack }).toEqual({ from, way, yaw, side, behind: true });
        }
        expect(shown).toBe(quarterOf(from + way));
      }
    }
  });

  test("[world:room-seen-down-its-length] given a finger moving to and fro across a quarter, when the walls follow, then the side walls are not swapped at each crossing; once the view is well round, the two sides facing away stand full", () => {
    let shown = wallsQuarter(180, 2, true);
    for (const yaw of [178, 183, 171, 186, 175, 182]) {
      shown = wallsQuarter(yaw, shown, false);
      expect({ yaw, shown }).toEqual({ yaw, shown: 2 });
    }
    // Well round toward 90 the right and the back face away: the quarter below's pair.
    expect(wallsQuarter(150, 2, false)).toBe(1);
    expect(fullSides(1).every((side) => away(side, 150) > 0)).toBe(true);
    // Toward 270 the back and the left still face away until the view rests there.
    expect(wallsQuarter(250, 2, false)).toBe(2);
    expect(wallsQuarter(270, 2, true)).toBe(3);
    // Round the circle's ends the same.
    expect(wallsQuarter(-10, 0, false)).toBe(0);
    expect(wallsQuarter(-30, 0, false)).toBe(3);
    expect(wallsQuarter(370, 0, false)).toBe(0);
  });

  test("[world:room-seen-down-its-length] [assets:assets-and-places-within-budget] given a shell's pairs in the scene, when a quarter's pair is shown, then exactly one wall of each side shows, the quarter's two full and the others knee-high, and a hidden wall takes no tap", () => {
    const { root, meshes } = shell();
    const walls = wallsOf(root);
    expect([...walls.keys()].sort()).toEqual([...WALL_SIDES].sort());
    for (const quarter of [0, 1, 2, 3]) {
      showWalls(walls, quarter);
      const full = new Set(fullSides(quarter));
      for (const side of WALL_SIDES) {
        expect({ quarter, side, full: meshes.get(wallNode(side, "full"))?.visible, low: meshes.get(wallNode(side, "low"))?.visible }).toEqual({ quarter, side, full: full.has(side), low: !full.has(side) });
      }
    }
    // Looking at the front wall from outside, low: a ray at the height only the full wall reaches passes where it is hidden.
    showWalls(walls, 2);
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 2.5, 20);
    camera.lookAt(new Vector3(0, 2.5, 0));
    camera.updateMatrixWorld(true);
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(0, 0), camera);
    const hits = ray.intersectObject(root, true).map((hit) => hit.object.name);
    expect(hits).not.toContain("wall_front_full");
    expect(hits[0]).toBe("wall_back_full");
    showWalls(walls, 0);
    expect(ray.intersectObject(root, true)[0]?.object.name).toBe("wall_front_full");
  });
});
