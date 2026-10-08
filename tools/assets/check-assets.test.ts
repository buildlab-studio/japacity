import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { RegisterRow, Review } from "@japacity/assets";
import { describe, expect, test } from "vitest";

import type { BakedModel } from "./bake";
import {
  type Budgets,
  checkAccepted,
  checkBudgets,
  checkCredits,
  checkDownloads,
  checkImages,
  checkNames,
  checkPlace,
  checkRegister,
  defaultPaths,
  expectedCredits,
  type Measured,
  OSM_CREDIT,
  type PlaceFile,
  runChecks,
} from "./check-assets";
import { readGlb, toDocument, writeGlb } from "./glb";
import { placeMapData } from "./map-data";
import { sha256 } from "./manifest";
import { checkPalette } from "./palette-check";
import type { Register } from "./register";

const ROOT = join(import.meta.dirname, "..", "..");
const budgets = JSON.parse(readFileSync(join(ROOT, "assets-src", "budgets.json"), "utf8")) as Budgets;
const config = { outlineMin: 85, dimTolerancePct: 5, minEach: 3, minPhone: 4, minMean: 3.5 };

const measured = (file: string, over: Partial<Measured> = {}): Measured => ({ file, triangles: 100, drawCalls: 1, materials: 1, bytes: 1000, minY: 0, maxY: 6, palette: [], signs: 0, ...over });
const row = (file: string, over: Partial<RegisterRow> = {}): RegisterRow => ({
  file, place: "shared", source: "code", author: "the pipeline work", licence: "CC BY-SA 4.0", attribution: null, aiTool: "an agent", date: "2026-10-08", modified: false,
  triangles: 100, drawCalls: 1, materials: 1, bytes: 1000, paletteCheck: { passed: true, date: "2026-10-08" }, reference: [], outline: null, review: null, nameCheck: null, status: "draft", ...over,
});
const review = (scores: Partial<Review["scores"]>): Review => ({ reviewer: "r", date: "2026-10-08", scores: { phone: 4, silhouette: 4, proportion: 4, palette: 4, wear: 4, variety: 4, budget: 5, ...scores }, mean: 0, notes: "" });

describe("names", () => {
  test("[R-ASSET-008] given shipped names, when they are checked, then the page's pattern passes and anything else fails, with place.json and credits.json allowed", () => {
    const good = ["places/ojuelegba/bld_shop-row.glb", "shared/chr/chr_body_plus-set.glb", "shared/chr/chr_hawker_a.glb", "shared/tex/tex_ankara_4.png", "places/x/place.json", "credits.json"];
    expect(checkNames(good)).toEqual([]);
    const bad = ["shared/chr/var_plus_short_busty.glb", "shared/chr/chr_Amaka.glb", "shared/chr/chr_a_b_c.glb", "places/x/bld_plaza.gltf", "places/x/photo.jpg", "places/x/lm_national_stadium_a.glb"];
    expect(checkNames(bad)).toHaveLength(bad.length);
  });
});

describe("the register", () => {
  test("[R-ASSET-009] given files and rows, when they are compared, then a file with no row, a row with no file and a figure that differs each fail", () => {
    expect(checkRegister([row("a/bld_a.glb")], [measured("a/bld_a.glb")])).toEqual([]);
    expect(checkRegister([], [measured("a/bld_a.glb")])).toEqual(["R-ASSET-009: a/bld_a.glb has no register row"]);
    expect(checkRegister([row("a/bld_a.glb")], [])).toEqual(["R-ASSET-009: register row a/bld_a.glb names no shipped file"]);
    expect(checkRegister([row("a/bld_a.glb", { bytes: 999 })], [measured("a/bld_a.glb")])[0]).toMatch(/bytes 999, the file has 1000/);
  });

  test("[R-ASSET-015] given a row made with an AI tool, when it names no tool, then it fails", () => {
    expect(checkRegister([row("a/bld_a.glb", { source: "ai-tool", aiTool: null })], [measured("a/bld_a.glb")])[0]).toMatch(/R-ASSET-015/);
    expect(checkRegister([row("a/bld_a.glb", { source: "ai-tool", aiTool: "a tool, a plan" })], [measured("a/bld_a.glb")])).toEqual([]);
  });

  test("[R-ASSET-009] given the repository, when every check runs, then every shipped file matches its register row and nothing fails", async () => {
    // The same place map data the command feeds in, so the credits file has one expected shape (R-CITY-021).
    const { problems } = await runChecks(defaultPaths(ROOT), placeMapData());
    expect(problems).toEqual([]);
  });
});

describe("budgets for one asset", () => {
  test("[R-ASSET-007] given a building at its budget and one over, when they are checked, then the first passes and every figure over fails", () => {
    const at = measured("p/bld_a.glb", { triangles: 1500, drawCalls: 1, materials: 1, bytes: 40000, maxY: 13 });
    expect(checkBudgets([at], budgets)).toEqual([]);
    const over = measured("p/bld_a.glb", { triangles: 1501, drawCalls: 2, materials: 2, bytes: 40001, maxY: 13.01 });
    expect(checkBudgets([over], budgets)).toHaveLength(5);
  });

  test("[R-ASSET-007] given a shopfront 3 to 4 m high and one 2.9 m, when heights are checked, then the range holds at its edges", () => {
    expect(checkBudgets([measured("p/shop_a.glb", { maxY: 3 }), measured("p/shop_b.glb", { maxY: 4 })], budgets)).toEqual([]);
    expect(checkBudgets([measured("p/shop_a.glb", { maxY: 2.9 })], budgets)).toHaveLength(1);
  });

  test("[R-ASSET-003] given a model 0.01 m off the ground and one 0.011 m, when it is checked, then the first stands on y = 0 and the second fails", () => {
    expect(checkBudgets([measured("p/prop_a.glb", { minY: 0.01 })], budgets)).toEqual([]);
    expect(checkBudgets([measured("p/prop_a.glb", { minY: -0.011 })], budgets)[0]).toMatch(/R-ASSET-003/);
  });

  test("[R-ASSET-001] given a file with a vertex colour off the palette, when its palette is checked, then it fails", async () => {
    const model: BakedModel = {
      name: "prop_bad",
      parts: [{ node: "body", primitives: [{ material: "body", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], colours: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], indices: [0, 1, 2] }] }],
      extras: {},
    };
    const doc = await readGlb(await writeGlb(toDocument(model)));
    expect(checkPalette(doc).length).toBeGreaterThan(0);
  });
});

describe("pictures", () => {
  test("[R-ASSET-011] given images under the asset folders, when they are checked, then only those the tools wrote, with their hash, pass", () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const manifest = { note: "", renders: { "assets-src/x/renders/front.png": sha256(bytes) }, patterns: {} };
    expect(checkImages([{ path: "assets-src/x/renders/front.png", bytes }], manifest)).toEqual([]);
    expect(checkImages([{ path: "assets-src/x/reference.jpg", bytes }, { path: "assets-src/x/renders/front.png", bytes }], manifest)[0]).toMatch(/no tool wrote/);
    expect(checkImages([{ path: "assets-src/x/renders/front.png", bytes: Uint8Array.from([9]) }], manifest)[0]).toMatch(/differs/);
  });
});

describe("acceptance", () => {
  const rows = [row("p/bld_a.glb", { status: "accepted" })];
  const none = new Map<string, null>();
  const check = (scores: Partial<Review["scores"]>): string[] => checkAccepted(rows, new Map([["p/bld_a.glb", review(scores)]]), none, config);

  test("[R-ASSET-022] given reviews at the edges, when acceptance is checked, then phone 4, no criterion under 3 and a mean of at least 3.5 pass, and a mean just under fails", () => {
    // Seven whole scores summing to 25 make a mean of 3.57, the lowest at or above 3.5; 24 make 3.43.
    expect(check({ phone: 4, silhouette: 3, proportion: 3, palette: 3, wear: 3, variety: 4, budget: 5 })).toEqual([]);
    expect(check({ phone: 4, silhouette: 3, proportion: 3, palette: 3, wear: 3, variety: 4, budget: 4 })[0]).toMatch(/mean of 3.43/);
  });

  test("[R-ASSET-022] given a phone score of 3, a criterion under 3, a mean under 3.5 or a budget of 0, when acceptance is checked, then each fails", () => {
    expect(check({ phone: 3 })).toHaveLength(1);
    expect(check({ wear: 2 })).toHaveLength(1);
    expect(check({ phone: 4, silhouette: 3, proportion: 3, palette: 3, wear: 3, variety: 3, budget: 4 })[0]).toMatch(/mean/);
    expect(check({ budget: 0 })).toContain("R-ASSET-022: p/bld_a.glb is accepted over budget");
    expect(checkAccepted(rows, new Map([["p/bld_a.glb", null]]), none, config)[0]).toMatch(/no review.json/);
  });

  test("[R-ASSET-023] given an accepted landmark, when its outline scores are missing or one view fails, then acceptance fails", () => {
    const lm = [row("p/lm_a.glb", { status: "accepted" })];
    const reviews = new Map([["p/lm_a.glb", review({})]]);
    expect(checkAccepted(lm, reviews, new Map([["p/lm_a.glb", { side: { passes: true }, plan: { passes: true } }]]), config)).toEqual([]);
    expect(checkAccepted(lm, reviews, new Map([["p/lm_a.glb", { side: { passes: true }, plan: { passes: false } }]]), config)).toHaveLength(1);
    expect(checkAccepted(lm, reviews, new Map([["p/lm_a.glb", null]]), config)).toHaveLength(1);
  });
});

describe("budgets for one place", () => {
  const files = new Map([
    ["p/bld_a.glb", measured("p/bld_a.glb", { triangles: 1000, signs: 2 })],
    ["s/chr_a.glb", measured("s/chr_a.glb", { triangles: 1500, drawCalls: 3 })],
  ]);
  const place = (low: number, high: number, buildings: number): PlaceFile => ({
    place: "place.x", scope: "exterior", hub: true, instances: [{ file: "p/bld_a.glb", count: buildings }], people: { low, high, sample: ["s/chr_a.glb"] }, groundRoadSky: { drawCalls: 4, triangles: 1000 },
  });

  test("[R-ASSET-007] given a hub, when it is counted in both modes, then instanced buildings cost one draw call, their signs one each, and people the heaviest of the sample times the crowd", () => {
    // 4 + 1 + 2 signs + 3 x 17 people = 58 draw calls in high mode: inside the first load's 60.
    expect(checkPlace(place(8, 17, 2), files, budgets)).toEqual([]);
    // One more person: 61.
    expect(checkPlace(place(8, 18, 2), files, budgets)[0]).toMatch(/61 draw calls in high mode/);
  });
});

describe("downloads", () => {
  test("[R-CITY-018] given the hub's folder, one character and the code, when the first download is counted, then 5 MB passes and a byte more fails", () => {
    const files = [measured("places/hub/bld_a.glb", { bytes: 1_000_000 }), measured("shared/chr/chr_a.glb", { bytes: 100_000 })];
    expect(checkDownloads(files, "places/hub", 3_900_000, budgets)).toEqual([]);
    expect(checkDownloads(files, "places/hub", 3_900_001, budgets)).toHaveLength(1);
  });
});

describe("credits", () => {
  const register: Register = { note: "", fonts: [{ family: "Danfo", licence: "OFL-1.1", source: "", attribution: "Danfo, OFL" }], rows: [row("a/prop_a.glb", { attribution: "A pack by someone, CC0" })] };

  test("[R-ASSET-024] given a plan outline taken from OpenStreetMap, when the credits are made, then the map data credit is there with its source", () => {
    const credits = expectedCredits(register, ["https://www.openstreetmap.org/way/1", "https://commons.wikimedia.org/wiki/File:x.jpg"]);
    expect(credits.mapData).toEqual([{ text: OSM_CREDIT, link: "https://www.openstreetmap.org/copyright", sources: ["https://www.openstreetmap.org/way/1"] }]);
  });

  test("[R-CITY-021] given the register, when credits.json differs from what it says, then the check fails", () => {
    const credits = expectedCredits(register, []);
    expect(credits.assets).toEqual([{ file: "a/prop_a.glb", attribution: "A pack by someone, CC0" }]);
    expect(checkCredits(credits, credits)).toEqual([]);
    expect(checkCredits({ ...credits, assets: [] }, credits)).toHaveLength(1);
    expect(checkCredits(null, credits)).toHaveLength(1);
  });
});
