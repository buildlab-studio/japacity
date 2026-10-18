import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { CATALOG, isPortrayed, isTiled, PORTRAITS, PUBLIC, SOURCE } from "./catalog";
import { readJson, REPO_ROOT } from "../repo";
import { listFiles, sourceFiles } from "./assets-check";
import { readGlb } from "./glb";
import { decodePng } from "./png";
import { FACE_SHOT, FIGURE_SHOT, mergeRecords, PHONE_SHOT, PORTRAIT_POSES, type RenderRecord, TILE_SHOT, viewsAsked } from "./shoot";
import { signText } from "./stage-browser";

const config = readJson<{ phoneShot: Record<string, number>; criteria: { key: string }[] }>(join(SOURCE, "review.config.json"));
const stage = readFileSync(join(SOURCE, "stage", "stage.ts"), "utf8");

describe("the fixed views", () => {
  test("[R-ASSET-020] given every asset, when its views are listed, then it gets the four elevations, the three-quarter view and the phone shot, and buildings and landmarks the plan", () => {
    for (const entry of CATALOG) expect(entry.views).toEqual(expect.arrayContaining(["front", "back", "left", "right", "threeQuarter", "phone"]));
    const planned = CATALOG.filter((entry) => /^(bld|lm|shop)_/.test(entry.name));
    expect(planned.filter((entry) => !entry.views.includes("plan")).map((entry) => entry.name)).toEqual([]);
  });

  test("[R-ASSET-020] given the phone shot, when its numbers are read, then it is 360 by 640 CSS pixels at device scale 2 and 12 m, as the review sheet's numbers say", () => {
    expect(PHONE_SHOT).toEqual({ width: 360, height: 640, deviceScaleFactor: 2, distance: 12 });
    expect(config.phoneShot).toMatchObject({ width: 360, height: 640, deviceScaleFactor: 2, distanceMetres: 12, lensDegrees: 32 });
    expect(stage).toMatch(/camera\.position\.set\(centreX, 1\.6, front \+ 12\)/);
  });

  test("[R-ASSET-020] given the shooter, when it launches a browser, then it uses Playwright's own Chromium with no hard-coded path, on the software renderer", () => {
    const sources = readdirSync(join(REPO_ROOT, "tools", "assets")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => readFileSync(join(REPO_ROOT, "tools", "assets", f), "utf8"));
    expect(sources.join("\n")).not.toMatch(/executablePath\s*:/);
    expect(sources.join("\n")).toMatch(/--use-angle=swiftshader/);
  });

  test("[R-ASSET-006] given the stage, when its lights are counted, then there is one sun and one sky and nothing else", () => {
    expect(stage.match(/new DirectionalLight\(/g)).toHaveLength(1);
    expect(stage.match(/new HemisphereLight\(/g)).toHaveLength(1);
    expect(stage).not.toMatch(/new (AmbientLight|PointLight|SpotLight|RectAreaLight)\(/);
  });

  test("[R-ASSET-021] given the review sheet, when its criteria are read, then they are the Review shape's seven scores, budget scored by the check", () => {
    expect(config.criteria.map((c) => c.key)).toEqual(["phone", "silhouette", "proportion", "palette", "wear", "variety", "budget"]);
  });

  test("[R-ASSET-021] given the examples sheet, when it is read, then it names the six examples the catalog ships, with their round-two totals and the bars 21, 21 and 20 of 35", () => {
    const examples = readJson<{ bar: Record<string, number>; examples: { name: string; file: string; roundTwo: Record<string, number>; roundTwoTotal: number }[] }>(join(SOURCE, "examples.json"));
    expect(examples.examples.map((e) => e.name).sort()).toEqual(CATALOG.filter((e) => e.example === true).map((e) => e.name).sort());
    for (const e of examples.examples) {
      expect(Object.values(e.roundTwo).reduce((a, b) => a + b, 0)).toBe(e.roundTwoTotal);
      expect(CATALOG.find((c) => c.name === e.name)?.file).toBe(e.file);
    }
    expect([examples.bar.building, examples.bar.shopfront, examples.bar.landmark, examples.bar.outOf]).toEqual([21, 21, 20, 35]);
  });

  test("[R-ASSET-012] given every sign anchor in a shipped model, when the stage letters it, then its words are the content's text table's and signs.json keeps none", async () => {
    const words = signText();
    const keys: string[] = [];
    for (const file of sourceFiles(listFiles(PUBLIC)).filter((path) => path.endsWith(".glb"))) {
      const doc = await readGlb(readFileSync(join(PUBLIC, file)));
      const root = doc.getRoot().getDefaultScene()?.listChildren()[0];
      for (const anchor of (root?.getExtras() as { signs?: { key: string }[] } | undefined)?.signs ?? []) keys.push(anchor.key);
    }
    expect(keys.length).toBeGreaterThanOrEqual(12);
    for (const key of keys) expect({ key, said: words[key] }).toEqual({ key, said: text[key] });
    expect(Object.values(words).every((said) => said.trim() !== "")).toBe(true);
    expect(Object.keys(readJson<object>(join(SOURCE, "signs.json")))).toEqual(["note"]);
  });
});

describe("the tile view", () => {
  const tiled = CATALOG.filter((entry) => isTiled(entry.name));
  const untiled = CATALOG.filter((entry) => !isTiled(entry.name));

  test("[R-ASSET-020] given the shells, sheets and grids no player is shown as a thing, when their views are listed, then none gets the tile, none is shot and none keeps a tile render", () => {
    const shown = ["bld_room_parlour", "bld_room_compound", "prop_sheet-flag_coarse", "prop_sheet-pennant_fine", "prop_water_coarse", "prop_water_fine", "prop_pole", "prop_drum-water", "prop_plank-walkway", "chr_tunde"];
    for (const name of shown) expect({ name, tiled: isTiled(name) }).toEqual({ name, tiled: false });
    expect(CATALOG.filter((entry) => entry.name.startsWith("bld_room_") || entry.name.startsWith("prop_sheet-") || entry.name.startsWith("prop_water_")).filter((entry) => entry.views.includes("tile")).map((entry) => entry.name)).toEqual([]);
    expect(untiled.filter((entry) => entry.views.includes("tile") || existsSync(join(REPO_ROOT, entry.source, "renders", "tile.png"))).map((entry) => entry.name)).toEqual([]);
    for (const name of ["prop_cooking-corner", "prop_bed", "veh_danfo", "lm_national-stadium", "bld_family-house", "shop_provisions"]) expect({ name, tiled: isTiled(name) }).toEqual({ name, tiled: true });
  });

  test("[R-ASSET-020] given every model a player can be shown as a thing, when its views are listed, then it gets the tile, and no person does", () => {
    expect(tiled.length).toBeGreaterThan(70);
    expect(tiled.filter((entry) => !entry.views.includes("tile")).map((entry) => entry.name)).toEqual([]);
    expect(CATALOG.filter((entry) => entry.name.startsWith("chr_") && entry.views.includes("tile")).map((entry) => entry.name)).toEqual([]);
    expect(CATALOG.filter((entry) => entry.views.includes("tile")).every((entry) => /^(prop|shop|veh|lm|bld)_/.test(entry.name))).toBe(true);
  });

  test("[R-ASSET-020] given every asset, when its renders folder is named, then no two assets share one, so no render is written over another's", () => {
    const sources = CATALOG.map((entry) => entry.source);
    expect(sources.filter((source, at) => sources.indexOf(source) !== at)).toEqual([]);
  });

  test("[R-ASSET-020] given the tile shot, when its numbers are read, then it is a square of 256 CSS pixels at device scale 2", () => {
    expect(TILE_SHOT).toEqual({ width: 256, height: 256, deviceScaleFactor: 2 });
  });

  test("[R-ASSET-006] given the stage, when it shows the tile, then the sky and the ground are left out on a clear page under the same one sun and one sky", () => {
    expect(stage).toMatch(/case "tile":/);
    expect(stage).toMatch(/alpha: true/);
    expect(stage).toMatch(/scene\.background = tile \? null : colour\("sky"\)/);
    expect(stage).toMatch(/ground\.visible = !tile/);
  });

  test("given the shooter's words, when only some views are asked for, then the asked ones are shot and the names left are the assets", () => {
    expect(viewsAsked(["--view", "tile", "prop_bed", "all"])).toEqual({ views: ["tile"], names: ["prop_bed", "all"] });
    expect(viewsAsked(["prop_bed"])).toEqual({ views: null, names: ["prop_bed"] });
  });

  test("given a render manifest, when only the tile is shot again, then the other views' records stay and the tile's is replaced, in the order of the entry's views", () => {
    const record = (view: RenderRecord["view"], sha256: string): RenderRecord => ({ view, file: `x/${view}.png`, sha256, viewport: { width: 1, height: 1, deviceScaleFactor: 1 }, camera: null });
    const merged = mergeRecords(["front", "threeQuarter", "phone", "tile"], [record("phone", "p"), record("front", "f"), record("tile", "old")], [record("tile", "new")]);
    expect(merged.map((r) => [r.view, r.sha256])).toEqual([["front", "f"], ["phone", "p"], ["tile", "new"]]);
  });

  test.each(tiled.map((entry) => ({ name: entry.name, source: entry.source })))("[R-ASSET-011] given $name's tile, when it is read, then it is 512 pixels square, clear at its corners and the asset fills it", ({ source }) => {
    const image = decodePng(readFileSync(join(REPO_ROOT, source, "renders", "tile.png")));
    expect([image.width, image.height]).toEqual([512, 512]);
    const alphaAt = (x: number, y: number): number => image.pixels[(y * image.width + x) * 4 + 3] ?? 255;
    expect([alphaAt(0, 0), alphaAt(511, 0), alphaAt(0, 511), alphaAt(511, 511)]).toEqual([0, 0, 0, 0]);
    let minX = 512;
    let maxX = -1;
    let minY = 512;
    let maxY = -1;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        if (alphaAt(x, y) < 128) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    // Tighter than the three-quarter view: the asset's longer side spans most of the square, with a margin for the sticker's edge.
    expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThan(380);
    expect(Math.min(minX, minY, 511 - maxX, 511 - maxY)).toBeGreaterThanOrEqual(8);
  });
});

describe("the door's portraits", () => {
  const portrayed = CATALOG.filter((entry) => PORTRAITS.some((view) => entry.views.includes(view)));
  const read = (source: string, view: string) => decodePng(readFileSync(join(REPO_ROOT, source, "renders", `${view}.png`)));

  test("[R-ASSET-020] [R-PROLOGUE-009] given the people, when their views are listed, then each look the door offers, and only those, gets its face, its whole figure and its cheer, and none of them the tile", () => {
    expect(portrayed.map((entry) => entry.name).sort()).toEqual(CATALOG.filter((entry) => isPortrayed(entry.name)).map((entry) => entry.name).sort());
    expect(portrayed.length).toBe(16);
    for (const entry of portrayed) expect({ name: entry.name, views: entry.views.filter((view) => PORTRAITS.includes(view)), tile: entry.views.includes("tile") }).toEqual({ name: entry.name, views: [...PORTRAITS], tile: false });
    expect(portrayed.every((entry) => entry.name.startsWith("chr_"))).toBe(true);
    for (const name of ["chr_hawker_a", "chr_hawker_b"]) expect(isPortrayed(name)).toBe(false);
  });

  test("[R-ASSET-020] given the portraits' shots, when their numbers and poses are read, then the face is 128 CSS pixels square and the figure 200 by 400, both at device scale 2, in the game's stand, hip and cheer poses, on the stage's clear ground", () => {
    expect(FACE_SHOT).toEqual({ width: 128, height: 128, deviceScaleFactor: 2 });
    expect(FIGURE_SHOT).toEqual({ width: 200, height: 400, deviceScaleFactor: 2 });
    expect(PORTRAIT_POSES).toEqual({ face: "stand", figure: "hip", cheer: "cheer" });
    expect(stage).toMatch(/case "face":\s*case "figure":\s*case "cheer":/);
    expect(stage).toMatch(/const CLEAR_VIEWS: readonly ViewName\[\] = \["tile", "face", "figure", "cheer"\]/);
  });

  test.each(portrayed.map((entry) => ({ name: entry.name, source: entry.source })))("[R-ASSET-011] given $name's portraits, when they are read, then the face is 256 pixels square and the figures 400 by 800, each clear at its corners with the person filling it", ({ source }) => {
    for (const [view, width, height] of [["face", 256, 256], ["figure", 400, 800], ["cheer", 400, 800]] as const) {
      const image = read(source, view);
      expect({ view, size: [image.width, image.height] }).toEqual({ view, size: [width, height] });
      const alphaAt = (x: number, y: number): number => image.pixels[(y * image.width + x) * 4 + 3] ?? 255;
      expect({ view, corners: [alphaAt(0, 0), alphaAt(width - 1, 0), alphaAt(0, height - 1), alphaAt(width - 1, height - 1)] }).toEqual({ view, corners: [0, 0, 0, 0] });
      let filled = 0;
      for (let y = 0; y < height; y += 4) for (let x = 0; x < width; x += 4) if (alphaAt(x, y) >= 128) filled += 1;
      // A person stands in the picture: a fair share of it is the figure, never a speck or a cropped blur.
      const share = filled / ((width / 4) * (height / 4));
      expect({ view, enough: share > (view === "face" ? 0.2 : 0.15), notAll: share < 0.9 }).toEqual({ view, enough: true, notAll: true });
    }
  });
});
