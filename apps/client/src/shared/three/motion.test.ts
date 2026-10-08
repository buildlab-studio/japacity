import { buildGrid } from "@japacity/assets-src/prop/motion/build";
import { GRIDS } from "@japacity/assets-src/prop/motion/grids";
import { type BufferGeometry, Color, InstancedMesh, type MeshLambertMaterial, Matrix4, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { bunting, gridFilesOf, keepGrid, loadGrids, puffGeometry, sheetGeometry, smoke, water } from "./motion";
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

  test("[R-ASSET-005] given a puff turning as it rises, when its shader is built, then its normals turn with it, so its light side stays toward the sun", () => {
    const material = smoke(4, [new Color(0xffffff)]).material as MeshLambertMaterial;
    const shader = { uniforms: {}, vertexShader: "#include <beginnormal_vertex>\n#include <begin_vertex>\n", fragmentShader: "" };
    material.onBeforeCompile(shader as unknown as Parameters<MeshLambertMaterial["onBeforeCompile"]>[0], undefined as unknown as Parameters<MeshLambertMaterial["onBeforeCompile"]>[1]);
    const turned = /objectNormal\.xz = mat2\(cos\(spin\), -sin\(spin\), sin\(spin\), cos\(spin\)\) \* objectNormal\.xz/;
    const moved = /transformed\.xz = mat2\(cos\(spin\), -sin\(spin\), sin\(spin\), cos\(spin\)\) \* transformed\.xz/;
    expect(shader.vertexShader).toMatch(turned);
    expect(shader.vertexShader).toMatch(moved);
    expect(shader.vertexShader.indexOf("objectNormal.xz =")).toBeLessThan(shader.vertexShader.indexOf("#include <begin_vertex>"));
  });
});

const triangles = (geometry: BufferGeometry): number => (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;

describe("mesh levels", () => {
  test("[R-CITY-028] given a place's motion, when its grid files are asked for at a level, then each sheet kind and the water name that level's file once, and smoke and leaves none", () => {
    expect(gridFilesOf(["flag", "smoke", "bunting", "flag", "leaves"], "fine")).toEqual(["shared/prop/prop_sheet-flag_fine.glb", "shared/prop/prop_sheet-pennant_fine.glb"]);
    expect(gridFilesOf(["hang", "frond", "water"], "coarse")).toEqual(["shared/prop/prop_sheet-hang_coarse.glb", "shared/prop/prop_sheet-frond_coarse.glb", "shared/prop/prop_water_coarse.glb"]);
  });

  test("[R-CITY-028] given grids that fail to load, when a sheet is built, then the grid built in code stands in at the same level", async () => {
    await loadGrids(["hang"], "fine", () => Promise.reject(new Error("not published")));
    const [across, down] = GRIDS["sheet-hang"].segments.fine;
    expect(triangles(sheetGeometry("hang", 0.6, 0.9, "fine"))).toBe(across * down * 2);
  });

  test("[R-CITY-028] given the shipped grids of both levels, when sheets, pennants and water are built, then the low mode draws the coarse file and the high mode the fine one, at the sheet's size with its pinned edge in place", async () => {
    await loadGrids(["hang", "bunting", "water"], "coarse", (path) => Promise.resolve(buildGrid(path.includes("hang") ? "sheet-hang" : path.includes("pennant") ? "sheet-pennant" : "water", "coarse")));
    for (const piece of ["sheet-hang", "sheet-pennant", "water"] as const) keepGrid(`shared/prop/prop_${piece}_fine.glb`, buildGrid(piece, "fine"));
    for (const level of ["coarse", "fine"] as const) {
      const [across, down] = GRIDS["sheet-hang"].segments[level];
      const hang = sheetGeometry("hang", 0.6, 0.9, level);
      expect(triangles(hang)).toBe(across * down * 2);
      hang.computeBoundingBox();
      expect(hang.boundingBox?.min.toArray().map((value) => Math.round(value * 100) + 0)).toEqual([-30, -90, 0]);
      expect(hang.boundingBox?.max.toArray().map((value) => Math.round(value * 100) + 0)).toEqual([30, 0, 0]);
      // The pinned top edge has v = 1, where the shader holds the sheet still.
      const uv = hang.getAttribute("uv");
      const position = hang.getAttribute("position");
      const pinned = Array.from({ length: position.count }, (_, at) => at).filter((at) => Math.abs(position.getY(at)) < 1e-6);
      expect(pinned).toHaveLength(across + 1);
      expect(pinned.map((at) => Math.round(uv.getY(at) * 1000))).toEqual(pinned.map(() => 1000));
      const pennants = bunting(new Vector3(0, 3, 0), new Vector3(4, 3, 0), 5, [new Color(0xff0000)], level);
      expect(triangles(pennants.geometry)).toBe(GRIDS["sheet-pennant"].segments[level][1] ** 2);
    }
  });

  test("[R-CITY-027] given the shipped water tile, when a lagoon 30 m by 20 m is laid, then it is one instanced draw call of tiles stretched to meet its edges, and the shader reads where each copy lies so the tiles join", () => {
    keepGrid("shared/prop/prop_water_fine.glb", buildGrid("water", "fine"));
    const lagoon = water(30, 20, "fine", new Color(0x4f6f66));
    expect(lagoon).toBeInstanceOf(InstancedMesh);
    const tiles = lagoon as InstancedMesh;
    expect(tiles.count).toBe(6);
    const matrix = new Matrix4();
    const corners: number[][] = [];
    for (let at = 0; at < tiles.count; at += 1) {
      tiles.getMatrixAt(at, matrix);
      corners.push([new Vector3(-6, 0, -6).applyMatrix4(matrix).x, new Vector3(6, 0, 6).applyMatrix4(matrix).z]);
    }
    expect(Math.min(...corners.map(([x = 0]) => x))).toBeCloseTo(-15);
    expect(Math.max(...corners.map(([, z = 0]) => z))).toBeCloseTo(10);
    const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>", fragmentShader: "#include <color_fragment>" };
    (tiles.material as MeshLambertMaterial).onBeforeCompile(shader as never, undefined as never);
    expect(shader.vertexShader).toContain("p = (instanceMatrix * vec4(position, 1.0)).xz;");
  });
});
