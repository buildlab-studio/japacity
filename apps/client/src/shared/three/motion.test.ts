import { buildGrid } from "@japacity/models/props/motion/build";
import { GRIDS } from "@japacity/models/props/motion/grids";
import { AdditiveBlending, BoxGeometry, type BufferGeometry, Color, CustomBlending, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshLambertMaterial, Matrix4, OneFactor, OneMinusSrcAlphaFactor, Raycaster, type ShaderMaterial, Sprite, Vector3 } from "three";
import { describe, expect, test } from "vitest";

import { instanceModel } from "./instance";
import { bunting, drops, flicker, glow, glowAt, type GlowPoint, glows, glowsAt, gridFilesOf, keepGrid, loadGrids, puffGeometry, rideWater, sheetGeometry, smoke, water } from "./motion";
import { PUFF_INDEX, PUFF_POSITIONS } from "./puff.data";

describe("smoke", () => {
  test("[assets:flat-and-smooth-shading] given the smoke, when it is built, then each puff is the blended shape from the build, its corners shared and its material smooth, not a faceted ball", () => {
    const puffs = smoke(20, [new Color(0xffffff)]);
    const material = puffs.material as MeshLambertMaterial;
    expect(material.flatShading).toBe(false);
    expect(material.transparent).toBe(false);
    expect(puffs.geometry.getIndex()?.count).toBe(PUFF_INDEX.length);
    expect(puffs.geometry.getAttribute("position").count).toBe(PUFF_POSITIONS.length / 3);
    expect(puffs.geometry.getAttribute("normal").count).toBe(PUFF_POSITIONS.length / 3);
  });

  test("[city:motion-in-vertex-shader] given the smoke, when it is built, then it is one instanced draw call whose copies each carry a seed, so the shader alone moves and shrinks them", () => {
    const puffs = smoke(30, [new Color(0xffffff), new Color(0x808080)]);
    expect(puffs.count).toBe(30);
    expect(puffs.geometry.getAttribute("aSeed").count).toBe(30);
    expect(puffGeometry().index?.count).toBe(PUFF_INDEX.length);
  });

  test("[assets:flat-and-smooth-shading] given a puff turning as it rises, when its shader is built, then its normals turn with it, so its light side stays toward the sun", () => {
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
  test("[city:motion-never-turned-off] given a place's motion, when its grid files are asked for at a level, then each sheet kind and the water name that level's file once, and smoke and leaves none", () => {
    expect(gridFilesOf(["flag", "smoke", "bunting", "flag", "leaves"], "fine")).toEqual(["shared/prop/prop_sheet-flag_fine.glb", "shared/prop/prop_sheet-pennant_fine.glb"]);
    expect(gridFilesOf(["hang", "frond", "water"], "coarse")).toEqual(["shared/prop/prop_sheet-hang_coarse.glb", "shared/prop/prop_sheet-frond_coarse.glb", "shared/prop/prop_water_coarse.glb"]);
  });

  test("[city:motion-never-turned-off] given grids that fail to load, when a sheet is built, then the grid built in code stands in at the same level", async () => {
    await loadGrids(["hang"], "fine", () => Promise.reject(new Error("not published")));
    const [across, down] = GRIDS["sheet-hang"].segments.fine;
    expect(triangles(sheetGeometry("hang", 0.6, 0.9, "fine"))).toBe(across * down * 2);
  });

  test("[city:motion-never-turned-off] given the shipped grids of both levels, when sheets, pennants and water are built, then the low mode draws the coarse file and the high mode the fine one, at the sheet's size with its pinned edge in place", async () => {
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

  test("[city:no-script-loop-per-sheet] given the shipped water tile, when a lagoon 30 m by 20 m is laid, then it is one instanced draw call of tiles stretched to meet its edges, and the shader reads where each copy lies so the tiles join", () => {
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

describe("riding the water", () => {
  /** Two copies of a canoe-shaped box riding the water, and the vertex shader its one draw call compiles. */
  function riding(glide?: number): { mesh: InstancedMesh; shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string } } {
    const canoe = new Group();
    canoe.add(new Mesh(new BoxGeometry(0.9, 0.5, 6.4), new MeshLambertMaterial()));
    const copies = instanceModel(canoe, [[0, 6, Math.PI / 2], [4, 10, -Math.PI / 2]], "canoe");
    rideWater(copies, glide);
    expect(copies.children).toHaveLength(1);
    const mesh = copies.children[0] as InstancedMesh;
    const shader = { uniforms: {}, vertexShader: "#include <begin_vertex>", fragmentShader: "" };
    (mesh.material as MeshLambertMaterial).onBeforeCompile(shader as never, undefined as never);
    return { mesh, shader };
  }

  test("[city:no-script-loop-per-sheet] given canoes that travel a lane of 9 m, when their copies ride the water, then the vertex shader alone carries each out along its own length on the shared clock, turns it at the end and brings it back, in the one draw call, never culled or casting a shadow left behind", () => {
    const { mesh, shader } = riding(9);
    expect(mesh.count).toBe(2);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.castShadow).toBe(false);
    expect(shader.uniforms.uTime).toBeDefined();
    expect(shader.uniforms.uGlide?.value).toBe(9);
    expect(shader.vertexShader).toContain("uniform float uGlide;");
    expect(shader.vertexShader).toMatch(/float into = mod\(uTime/);
    expect(shader.vertexShader).toContain("transformed.z += along * uGlide;");
  });

  test("[city:no-script-loop-per-sheet] given a moored canoe, when it rides the water, then it only bobs where it is tied", () => {
    const { mesh, shader } = riding();
    expect(mesh.frustumCulled).toBe(true);
    expect(shader.vertexShader).toContain("float roll = sin(uTime");
    expect(shader.vertexShader).not.toContain("uGlide");
  });
});

/** A material's shaders as the scene compiles them, from a stand-in of three's own chunks. */
function compiled(material: MeshLambertMaterial | MeshBasicMaterial): { vertexShader: string; fragmentShader: string } {
  const shader = { uniforms: {}, vertexShader: "#include <beginnormal_vertex>\n#include <begin_vertex>\n", fragmentShader: "#include <color_fragment>\n" };
  material.onBeforeCompile(shader as unknown as Parameters<MeshLambertMaterial["onBeforeCompile"]>[0], undefined as unknown as Parameters<MeshLambertMaterial["onBeforeCompile"]>[1]);
  return shader;
}

describe("the fx of the room's acts", () => {
  test("[world:things-are-tappable-models] given the bucket bath, when its drops are built, then they are one instanced draw call round the drum's rim, opaque, each with its seed and its fall, moved and shrunk by the shader alone", () => {
    const water = drops(10, 0.6, 0.6, 0.9, new Color(0x9cc3d5));
    expect(water).toBeInstanceOf(InstancedMesh);
    expect(water.count).toBe(10);
    expect((water.material as MeshLambertMaterial).transparent).toBe(false);
    expect(water.geometry.getAttribute("aSeed").count).toBe(10);
    expect(water.geometry.getAttribute("aFall").getX(0)).toBeCloseTo(0.9, 6);
    const spot = new Vector3();
    const matrix = new Matrix4();
    for (let index = 0; index < 10; index += 1) {
      water.getMatrixAt(index, matrix);
      spot.setFromMatrixPosition(matrix);
      expect(Math.hypot(spot.x, spot.z)).toBeCloseTo(0.3, 6);
      expect(spot.y).toBe(0);
    }
    const shader = compiled(water.material as MeshLambertMaterial);
    expect(shader.vertexShader).toContain("attribute float aFall;");
    expect(shader.vertexShader).toMatch(/transformed\.y -= life \* life \* aFall/);
  });

  test("[world:things-are-tappable-models] given the television while it plays, when its flicker is built, then it is one unlit plane on the screen whose brightness alone moves on the shared clock, never transparent", () => {
    const screen = flicker(1.1, 0.6, new Color(0xdfe8ff));
    const material = screen.material as MeshBasicMaterial;
    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.transparent).toBe(false);
    screen.geometry.computeBoundingBox();
    expect(screen.geometry.boundingBox?.min.y).toBeCloseTo(0, 6);
    expect(screen.geometry.boundingBox?.max.y).toBeCloseTo(0.6, 6);
    const shader = compiled(material);
    expect(shader.fragmentShader).toContain("uniform float uTime;");
    expect(shader.fragmentShader).toMatch(/diffuseColor\.rgb \*= flick/);
  });

  test("[clock:game-day-on-real-time] [assets:lighting-set-by-place] given a lamp, when its glow is built and set, then it adds no light to the scene: an unlit bead and a soft halo added to what is behind, out at nothing, brighter when turned up", () => {
    const lamp = glow(0.6, new Color(0xffb36b));
    const lights: unknown[] = [];
    lamp.traverse((object) => {
      if ((object as { isLight?: boolean }).isLight === true) lights.push(object);
    });
    expect(lights).toEqual([]);
    const round = lamp.children.find((child): child is Sprite => child instanceof Sprite);
    if (round === undefined) throw new Error("No halo");
    expect(round.material.blending).toBe(AdditiveBlending);
    expect(round.material.depthWrite).toBe(false);
    expect(lamp.children.some((child) => child instanceof Mesh && child.material instanceof MeshBasicMaterial)).toBe(true);
    glowAt(lamp, 0);
    expect(lamp.visible).toBe(false);
    glowAt(lamp, 1);
    expect(lamp.visible).toBe(true);
    const full = round.scale.x;
    glowAt(lamp, 1.5);
    expect(round.scale.x).toBeGreaterThan(full);
    expect(glow(0.6, new Color(0xffffff), false).children.every((child) => child instanceof Sprite)).toBe(true);
  });
});

describe("the lamps' glow", () => {
  const LAMPS: GlowPoint[] = [
    { at: [-5, 2.5, 5.6], radius: 1, bead: true },
    { at: [8, 1.1, 5.6], radius: 0.6, bead: false },
  ];

  test("[clock:game-day-on-real-time] [assets:lighting-set-by-place] given a place's lamps, when their glow is built, then every bead and halo is one mesh with one material, so the night adds one draw call, and it adds no light, out at nothing and brighter when turned up", () => {
    const lit = glows(LAMPS, new Color(0xffb46a));
    expect(lit).toBeInstanceOf(Mesh);
    expect(lit.children).toEqual([]);
    expect(Array.isArray(lit.material)).toBe(false);
    expect((lit as unknown as { isLight?: boolean }).isLight).toBeUndefined();
    expect(lit.geometry.getAttribute("position").count).toBe(LAMPS.length * 4);
    expect(lit.geometry.getIndex()?.count).toBe(LAMPS.length * 6);
    const beads = lit.geometry.getAttribute("aBead");
    expect(beads.getX(0)).toBeGreaterThan(0);
    expect(beads.getX(4)).toBe(0);
    const material = lit.material as ShaderMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(CustomBlending);
    expect([material.blendSrc, material.blendDst]).toEqual([OneFactor, OneMinusSrcAlphaFactor]);
    glowsAt(lit, 0);
    expect(lit.visible).toBe(false);
    glowsAt(lit, 1);
    expect(lit.visible).toBe(true);
    glowsAt(lit, 1.5);
    expect(material.uniforms["uStrength"]?.value).toBe(1.5);
  });

  test("[assets:lighting-set-by-place] given a lamp with a bulb, when its glow is built in one mesh and on its own, then the halo takes the lamp's colour and the bead the same paler colour as the bead drawn on its own", () => {
    const colour = new Color(0xffb46a);
    const material = glows(LAMPS, colour).material as ShaderMaterial;
    const own = glow(1, colour).children.find((child): child is Mesh => child instanceof Mesh);
    if (own === undefined) throw new Error("No bead");
    expect((material.uniforms["uHaloColour"]?.value as Color).getHex()).toBe(colour.getHex());
    expect((material.uniforms["uBeadColour"]?.value as Color).getHex()).toBe((own.material as MeshBasicMaterial).color.getHex());
  });

  test("[clock:game-day-on-real-time] given the lamps' glow, when its bounds are read, then they hold every halo at its brightest, so the glow is culled only when every lamp is out of view", () => {
    const lit = glows(LAMPS, new Color(0xffb46a));
    const bounds = lit.geometry.boundingSphere;
    if (bounds === null) throw new Error("No bounds");
    for (const lamp of LAMPS) expect(bounds.center.distanceTo(new Vector3(...lamp.at)) + lamp.radius * (0.6 + 0.4 * 1.6)).toBeLessThanOrEqual(bounds.radius + 1e-6);
  });

  test("[city:tap-to-walk] given the lamps' glow standing between the camera and the ground, when a tap's ray passes through a halo, then it meets nothing, so the tap goes to what stands behind", () => {
    const lit = glows(LAMPS, new Color(0xffb46a));
    const ray = new Raycaster(new Vector3(-5, 2.5, 20), new Vector3(0, 0, -1));
    expect(ray.intersectObject(lit)).toEqual([]);
  });
});
