import { readFileSync } from "node:fs";
import { join } from "node:path";

import { girderDepth, BRIDGE } from "@japacity/assets-src/lm/third-mainland-span/build";
import { describe, expect, test } from "vitest";

import { bakeGroup } from "./bake";
import { CATALOG, PUBLIC, SOURCE } from "./catalog";
import { measure, readGlb, toDocument, writeGlb } from "./glb";
import { checkPalette } from "./palette-check";
import { readJson } from "../repo";

const entry = (name: string) => {
  const found = CATALOG.find((e) => e.name === name);
  if (found === undefined) throw new Error(name);
  return found;
};
const roundTrip = async (name: string) => readGlb(await writeGlb(toDocument(entry(name).build())));
/** The fabric bake runs past the default five seconds when the machine is loaded. */
const FABRIC_BAKE_MS = 30000;

describe("baking and compressing", () => {
  test("[assets:flat-and-smooth-shading] given an ordinary building, when it is baked and compressed, then it is one opaque vertex-coloured material in one draw call, with no normals in the file", async () => {
    const doc = await roundTrip("bld_plaza");
    const figures = measure(doc, 0);
    expect([figures.materials, figures.drawCalls]).toEqual([1, 1]);
    const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
    expect(prim?.getAttribute("COLOR_0")).not.toBeNull();
    expect(prim?.getAttribute("NORMAL")).toBeNull();
    expect(doc.getRoot().listMaterials()[0]?.getAlphaMode()).toBe("OPAQUE");
  });

  test("[assets:flat-and-smooth-shading] given a person with a fabric pattern, when they are baked, then the file has two materials and the pattern's every pixel is a palette colour", async () => {
    const doc = await roundTrip("chr_amaka");
    expect(doc.getRoot().listMaterials()).toHaveLength(2);
    expect(doc.getRoot().listTextures()).toHaveLength(1);
    expect(checkPalette(doc)).toEqual([]);
  }, FABRIC_BAKE_MS);

  test("[assets:sign-text-drawn-in-code] given a building with shops, when it is baked, then its file carries the sign anchors as text keys and no sign face, texture or word", () => {
    const built = entry("bld_shop-row").build();
    expect(built.parts.flatMap((part) => part.primitives.map((p) => p.material))).toEqual(["body"]);
    const signs = built.extras.signs as { key: string }[];
    expect(signs.map((s) => s.key)).toEqual(["place.ojuelegba.sign.1", "place.ojuelegba.sign.2", "place.ojuelegba.sign.3", "place.ojuelegba.sign.4"]);
    const bytes = readFileSync(join(PUBLIC, entry("bld_shop-row").file));
    expect(bytes.includes(Buffer.from("PROVISIONS"))).toBe(false);
  });

  test("[assets:sign-text-drawn-in-code] given a shopfront, when it is baked, then its sign faces are a second material with no image, mapped into one atlas of 512 by 128", async () => {
    const doc = await roundTrip("shop_provisions");
    const materials = doc.getRoot().listMaterials();
    expect(materials.map((m) => m.getName())).toEqual(["body", "sign"]);
    expect(materials[1]?.getBaseColorTexture()).toBeNull();
    expect(doc.getRoot().listTextures()).toHaveLength(0);
  });

  test("[assets:lighting-set-by-place] given any shipped model, when it is read, then it carries no light and no camera: the place sets the one sun and one sky", async () => {
    for (const name of ["bld_plaza", "lm_national-stadium", "veh_danfo"]) {
      const doc = await roundTrip(name);
      expect(doc.getRoot().listCameras()).toHaveLength(0);
      expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).not.toContain("KHR_lights_punctual");
    }
  });

  test("[assets:metre-units-and-origin] given every shipped model, when it is baked, then its lowest point is y = 0 within 0.01 m", async () => {
    for (const e of CATALOG.filter((c) => !c.name.startsWith("chr_"))) {
      const doc = await readGlb(readFileSync(join(PUBLIC, e.file)));
      expect(Math.abs(measure(doc, 0).minY)).toBeLessThanOrEqual(0.01);
    }
  });

  test("[assets:colours-from-named-palette] given a part whose material names no palette colour, when it is baked, then the bake refuses it", async () => {
    const { Group, Mesh, BoxGeometry, MeshStandardMaterial } = await import("three");
    const g = new Group();
    g.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: 0x123456 })));
    expect(() => bakeGroup(g, "prop_x", { shipSigns: false })).toThrow(/assets:colours-from-named-palette/);
  });
});

describe("the long landmark", () => {
  test("[assets:long-landmark-repeats-segment] given the bridge, when it is built, then it is about 600 m of 45 m bays of one repeating segment, flat for most of the span and deep over the piers", () => {
    expect(BRIDGE.bays * BRIDGE.bay).toBe(585);
    expect(girderDepth(0)).toBeCloseTo(3.5, 6);
    expect(girderDepth(1)).toBeCloseTo(6.5, 6);
    expect(girderDepth(-1)).toBeCloseTo(6.5, 6);
    expect(girderDepth(0.5) - girderDepth(0)).toBeLessThan(0.2);
    const outline = readJson<{ views: { view: string; modelRange?: number[] }[] }>(join(SOURCE, "lm", "third-mainland-span", "outline.json"));
    const elevation = outline.views.find((v) => v.view === "front");
    expect((elevation?.modelRange?.[1] ?? 0) - (elevation?.modelRange?.[0] ?? 0)).toBe(3 * BRIDGE.bay);
    expect(outline.views.map((v) => v.view)).toContain("plan");
  });
});
