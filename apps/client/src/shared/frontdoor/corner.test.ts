// The tailor's corner behind "Who are you?" (prologue.md R-PROLOGUE-016): a small still nook of 6 by 4 metres seen from
// the front at the figure's height, a shelf of three bolts in the game's own prints, a rail with two hangers and a
// mirror, at most eight draw calls; the compound dimmed behind the next two screens.
import { boltFaces, boltsOf, TAILOR } from "@japacity/assets-src/bld/tailor/tailor";
import { buildTailorCorner } from "@japacity/assets-src/bld/tailor/build";
import { drawPattern } from "@japacity/assets/pattern";
import { Bone, BufferAttribute, BufferGeometry, DataTexture, Group, type Mesh, MeshStandardMaterial, PerspectiveCamera, Skeleton, SkinnedMesh, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import raw from "../../../public/assets/places/tailor-corner/place.json";
import type { PlaceFile } from "../../features/city/placeFile";
import { measured } from "../../features/city/places/placeTesting";
import { figureOf } from "../three/people";
import { backdropOf, SCRIM } from "./backdrop";
import { boltTexture, fabricGround, fabricPrint, wear } from "./colours";
import { boltPrints, CORNER, CORNER_DRAW_CALLS, cornerCamera, EYE } from "./corner";

const file = raw as unknown as PlaceFile;
const KIT = `places/${CORNER}/bld_tailor-corner.glb`;
const FABRICS = ["ankara", "adire", "aso-oke"] as const;

/** Where a point lands on a canvas `width` by `height` seen through the corner's camera, in pixels from the top left. */
function seen(width: number, height: number, point: readonly [number, number, number]): [number, number] {
  const shot = cornerCamera(height);
  const lens = new PerspectiveCamera(shot.fov, width / height, 0.5, 40);
  lens.position.set(...shot.position);
  lens.lookAt(...shot.target);
  lens.setViewOffset(width, shot.fullHeight, 0, shot.offsetY, width, height);
  lens.updateProjectionMatrix();
  lens.updateMatrixWorld(true);
  const at = new Vector3(...point).project(lens);
  return [((at.x + 1) / 2) * width, ((1 - at.y) / 2) * height];
}

/** A look not made in any of the three prints, its top printed, as the people builder makes one. */
function printedLook(): Group {
  const bones = ["hips", "chest", "head", "handL"].map((name) => Object.assign(new Bone(), { name }));
  const skeleton = new Skeleton(bones);
  const root = new Group();
  root.name = "chr_test_tailor";
  root.add(bones[0]!);
  for (const bone of bones.slice(1)) bones[0]!.add(bone);
  const mesh = (count: number, bone: number, material: MeshStandardMaterial): SkinnedMesh => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3).fill(0.5), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3).fill(0.6), 3));
    geometry.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(Array.from({ length: count }, () => [bone, 0, 0, 0]).flat()), 4));
    geometry.setAttribute("skinWeight", new BufferAttribute(new Float32Array(Array.from({ length: count }, () => [1, 0, 0, 0]).flat()), 4));
    const skinned = new SkinnedMesh(geometry, material);
    skinned.bind(skeleton);
    return skinned;
  };
  root.add(mesh(6, 3, Object.assign(new MeshStandardMaterial({ vertexColors: true }), { name: "body" })));
  const made = new DataTexture(new Uint8Array(4 * 4 * 4).fill(200), 4, 4);
  root.add(mesh(6, 1, Object.assign(new MeshStandardMaterial({ vertexColors: true, map: made }), { name: "pattern" })));
  return root;
}

describe("the tailor's corner", () => {
  test("[R-PROLOGUE-016] given the door's screens, when what stands behind each is read, then the tailor's corner stands behind Who are you, the family compound behind Your life so far, the ready lives and Your page before and after Begin, and nothing behind any other screen; the scrim lets it show through", () => {
    expect(backdropOf("you")).toBe("corner");
    for (const mark of ["life", "ready", "page", "begun"]) expect({ mark, behind: backdropOf(mark) }).toEqual({ mark, behind: "compound" });
    for (const mark of ["prologue", "years", "handover", "", undefined]) expect({ mark, behind: backdropOf(mark) }).toEqual({ mark, behind: null });
    // Translucent: the backdrop shows, and more of the band than of it, so the figure and the sheet lead.
    expect(SCRIM).toBeGreaterThan(0.5);
    expect(SCRIM).toBeLessThan(0.8);
  });

  test("[R-PROLOGUE-016] given the corner's kit as the room's builder makes it and as shipped, when it is read and measured, then it is a nook of 6 by 4 metres with a shelf of three bolts, a rail with two hangers and a mirror, in one draw call", async () => {
    expect(TAILOR.room.size).toEqual([6, 4]);
    expect(TAILOR.bolts.map((bolt) => bolt.fabric)).toEqual([...FABRICS]);
    expect(TAILOR.hangers).toHaveLength(2);
    expect(TAILOR.mirror.high).toBeGreaterThan(TAILOR.mirror.width);
    // The bolts lie on the shelf's boards, between its sides, their backs off the back wall.
    const back = -TAILOR.room.size[1] / 2;
    for (const bolt of boltsOf()) {
      expect(Math.abs(bolt.x - TAILOR.shelf.x) + TAILOR.bolt.width / 2).toBeLessThan(TAILOR.shelf.width / 2);
      expect(bolt.z - TAILOR.bolt.deep / 2).toBeGreaterThan(back);
      expect(TAILOR.shelf.boards.some((board) => Math.abs(bolt.y - board - 0.03) < 1e-9)).toBe(true);
    }
    const kit = buildTailorCorner();
    expect(kit.name).toBe("bld_tailor-corner");
    const shipped = await measured(KIT);
    expect(shipped.drawCalls).toBe(1);
    expect(shipped.materials).toBe(1);
    // The walls stand 0.2 m thick outside the floor, their heads a little more; the walls are 3 m high.
    expect(shipped.size[0]).toBeGreaterThan(6);
    expect(shipped.size[0]).toBeLessThan(6.5);
    expect(shipped.size[2]).toBeGreaterThan(4);
    expect(shipped.size[2]).toBeLessThan(4.5);
    expect(shipped.maxY).toBeLessThan(3.2);
  });

  test("[R-PROLOGUE-016] given the corner's place file, when it is read, then it shows the kit alone on its floor, nobody stands in it and nothing in it moves", () => {
    const stage = file.stage!;
    expect(file.scope).toBe("interior");
    expect(stage.models).toEqual([{ file: KIT, at: [[0, 0, 0]] }]);
    expect(file.instances).toEqual([{ file: KIT, count: 1 }]);
    expect(stage.people).toEqual([]);
    expect(file.people).toEqual({ low: 0, high: 0, sample: [] });
    expect(stage.motion).toEqual([]);
    expect(stage.shows ?? []).toEqual([]);
    expect(stage.dressings ?? []).toEqual([]);
    expect(stage.ground.size).toEqual([TAILOR.room.size[0] + 0.6, TAILOR.room.size[1] + 0.6]);
  });

  test("[R-PROLOGUE-016] given the corner as the door draws it, when its draw calls are counted, then the kit, the floor and the three fabrics' prints come to at most eight", async () => {
    const prints = boltPrints(boltTexture);
    const meshes: Mesh[] = [];
    prints.traverse((object) => {
      if ((object as Mesh).isMesh) meshes.push(object as Mesh);
    });
    // One mesh and one material a fabric: the front and the top of its bolt drawn together.
    expect(meshes.map((mesh) => mesh.name).sort()).toEqual(FABRICS.map((fabric) => `bolt-${fabric}`).sort());
    expect(meshes.every((mesh) => !Array.isArray(mesh.material))).toBe(true);
    const kit = await measured(KIT);
    const floor = (raw as { groundRoadSky: { drawCalls: number; triangles: number } }).groundRoadSky;
    const drawCalls = kit.drawCalls + floor.drawCalls + meshes.length;
    const triangles = kit.triangles + floor.triangles + meshes.reduce((sum, mesh) => sum + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0);
    expect(drawCalls).toBeLessThanOrEqual(CORNER_DRAW_CALLS);
    expect(CORNER_DRAW_CALLS).toBe(8);
    expect(triangles).toBeLessThan(1000);
  });

  test("[R-PROLOGUE-016] given the three bolts, when their prints are drawn, then each is the pattern code's own print for that fabric on its own ground, the bolt's body is painted that ground, and a figure picking that fabric in that colour wears the very same print", () => {
    const prints = boltPrints(boltTexture);
    for (const fabric of FABRICS) {
      const mesh = prints.getObjectByName(`bolt-${fabric}`) as Mesh;
      const map = (mesh.material as MeshStandardMaterial).map as DataTexture;
      expect(map).toBe(boltTexture(fabric));
      const drawn = drawPattern(fabricPrint(fabric));
      expect([...(map.image.data as Uint8Array)]).toEqual([...drawn.pixels]);
      expect(TAILOR.bolts.find((bolt) => bolt.fabric === fabric)?.ground).toBe(fabricGround(fabric));
      // The fabric picked on the sheet, on a look not made in it, in the bolt's own colour: the bolt's print itself.
      const figure = figureOf(printedLook(), "stand", 0);
      wear(figure.root, { fabric, top: fabricGround(fabric) });
      let worn: unknown = null;
      figure.root.traverse((object) => {
        const material = (object as Mesh).material as MeshStandardMaterial | undefined;
        if (material?.name === "pattern") worn = material.map;
      });
      expect(worn).toBe(map);
    }
    // Each bolt shows its print on its folded front and its top.
    expect(boltFaces().map((face) => `${face.fabric} ${face.facing}`)).toEqual(FABRICS.flatMap((fabric) => [`${fabric} front`, `${fabric} top`]));
  });

  test("[R-PROLOGUE-016] given a phone held upright, when the corner's camera frames it, then it stands at the figure's height square to the back wall, and the shelf, the mirror and the rail stand inside the space above the sheet", () => {
    for (const [width, height] of [
      [390, 844],
      [360, 740],
      [430, 932],
    ] as const) {
      const shot = cornerCamera(height);
      expect(shot.position[1]).toBe(EYE);
      expect(EYE).toBeGreaterThan(1.1);
      expect(EYE).toBeLessThan(1.6);
      // Square to the wall: no tilt and no turn, so its verticals stand upright.
      expect(shot.target[1]).toBe(shot.position[1]);
      expect(shot.target[0]).toBe(shot.position[0]);
      const back = -TAILOR.room.size[1] / 2;
      const things: [string, [number, number, number]][] = [
        ["shelf, left edge", [TAILOR.shelf.x - TAILOR.shelf.width / 2, 1, back + TAILOR.shelf.depth]],
        ["shelf, top", [TAILOR.shelf.x, TAILOR.shelf.high, back + TAILOR.shelf.depth]],
        ["mirror", [TAILOR.mirror.x, TAILOR.mirror.bottom + TAILOR.mirror.high / 2, back]],
        ["rail, right edge", [TAILOR.rail.x + TAILOR.rail.width / 2, TAILOR.rail.high, back + TAILOR.rail.off]],
        ["the lowest bolt", [boltsOf()[0]!.x, boltsOf()[0]!.y, boltsOf()[0]!.z]],
      ];
      for (const [name, point] of things) {
        const [x, y] = seen(width, height, point);
        // Across the screen, and between the header and the sheet, which takes at most the lower half.
        expect({ name, width, inside: x > 0 && x < width && y > height * 0.1 && y < height * 0.5 }).toEqual({ name, width, inside: true });
      }
    }
  });
});
