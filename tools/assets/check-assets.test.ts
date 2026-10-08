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
  checkMadeWith,
  checkMediaRows,
  checkNames,
  checkPlace,
  checkRegister,
  defaultPaths,
  expectedCredits,
  type Measured,
  OSM_CREDIT,
  lastRound,
  type PlaceFile,
  rowFor,
  runChecks,
  sourceFiles,
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
  file, place: "shared", source: "code", author: "the pipeline work", licence: "CC BY-SA 4.0", attribution: null, generated: true, tool: "an agent", approvedBy: null, date: "2026-10-08", modified: false,
  triangles: 100, drawCalls: 1, materials: 1, bytes: 1000, paletteCheck: { passed: true, date: "2026-10-08" }, reference: [], outline: null, review: null, nameCheck: null, status: "draft", ...over,
});
const review = (scores: Partial<Review["scores"]>): Review => ({
  reviewer: "r", date: "2026-10-08", scores: { phone: 4, silhouette: 4, proportion: 4, palette: 4, wear: 4, variety: 4, budget: 5, ...scores }, mean: 0, notes: "", accepted: true, failing: [], reasons: {},
});

describe("names", () => {
  test("[R-ASSET-008] given shipped names, when they are checked, then the page's pattern passes and anything else fails, with place.json and credits.json allowed", () => {
    const good = ["places/ojuelegba/bld_shop-row.glb", "shared/chr/chr_body_plus-set.glb", "shared/chr/chr_hawker_a.glb", "shared/tex/tex_ankara_4.png", "places/x/place.json", "credits.json"];
    expect(checkNames(good)).toEqual([]);
    const bad = ["shared/chr/var_plus_short_busty.glb", "shared/chr/chr_Amaka.glb", "shared/chr/chr_a_b_c.glb", "places/x/bld_plaza.gltf", "places/x/photo.jpg", "places/x/lm_national_stadium_a.glb"];
    expect(checkNames(bad)).toHaveLength(bad.length);
  });

  test("[R-CITY-018] given the publish step's manifest and hashed copies beside their sources, when names are checked, then the copies are skipped and the manifest allowed, and a name that only looks hashed is not", () => {
    const files = ["manifest.json", "places/x/bld_plaza.glb", "places/x/bld_plaza.0123456789ab.glb", "places/x/place.0123456789ab.json", "credits.0123456789ab.json"];
    expect(sourceFiles(files)).toEqual(["manifest.json", "places/x/bld_plaza.glb"]);
    expect(checkNames(sourceFiles(files))).toEqual([]);
    expect(sourceFiles(["places/x/bld_plaza.0123456789.glb"])).toHaveLength(1);
  });
});

describe("the register", () => {
  test("[R-ASSET-009] given files and rows, when they are compared, then a file with no row, a row with no file and a figure that differs each fail", () => {
    expect(checkRegister([row("a/bld_a.glb")], [measured("a/bld_a.glb")])).toEqual([]);
    expect(checkRegister([], [measured("a/bld_a.glb")])).toEqual(["R-ASSET-009: a/bld_a.glb has no register row"]);
    expect(checkRegister([row("a/bld_a.glb")], [])).toEqual(["R-ASSET-009: register row a/bld_a.glb names no shipped file"]);
    expect(checkRegister([row("a/bld_a.glb", { bytes: 999 })], [measured("a/bld_a.glb")])[0]).toMatch(/bytes 999, the file has 1000/);
  });

  test("[R-ASSET-015] given a row made with an AI tool, when it names no tool, then it fails at any status, and a row from an AI tool must say it was generated", () => {
    expect(checkMadeWith([row("a/bld_a.glb", { tool: null })])[0]).toMatch(/R-ASSET-015: a\/bld_a.glb was made with an AI tool and its row names none/);
    expect(checkMadeWith([row("a/bld_a.glb", { tool: " " })])).toHaveLength(1);
    expect(checkMadeWith([row("a/bld_a.glb", { tool: "a tool, a plan" })])).toEqual([]);
    expect(checkMadeWith([row("a/bld_a.glb", { source: "ai-tool", generated: false, tool: null })])[0]).toMatch(/says it was not generated/);
    expect(checkMadeWith([row("a/bld_a.glb", { source: "artist", generated: false, tool: null })])).toEqual([]);
  });

  test("[R-ASSET-015] given an AI-made row, when it is accepted with no approver, then it fails, and with an approver or still a draft it passes", () => {
    expect(checkMadeWith([row("a/bld_a.glb", { status: "accepted", approvedBy: null })])[0]).toMatch(/is accepted with no one named as approving it/);
    expect(checkMadeWith([row("a/bld_a.glb", { status: "accepted", approvedBy: "" })])).toHaveLength(1);
    expect(checkMadeWith([row("a/bld_a.glb", { status: "accepted", approvedBy: "the maintainer" })])).toEqual([]);
    expect(checkMadeWith([row("a/bld_a.glb", { status: "draft", approvedBy: null }), row("a/bld_b.glb", { status: "rejected", approvedBy: null })])).toEqual([]);
    expect(checkMadeWith([row("a/bld_a.glb", { generated: false, tool: null, status: "accepted", approvedBy: null })])).toEqual([]);
  });

  test("[R-GUIDE-013] given a register row, when it lacks whether it was generated, its tool or its approver, then the check names each missing column", () => {
    const bare = row("a/bld_a.glb") as unknown as Record<string, unknown>;
    delete bare.generated;
    delete bare.approvedBy;
    expect(checkMadeWith([bare as unknown as RegisterRow])).toEqual(["R-GUIDE-013: register row a/bld_a.glb has no generated, approvedBy"]);
    expect(checkMadeWith([row("a/bld_a.glb", { tool: 3 as unknown as string })])).toEqual(["R-GUIDE-013: register row a/bld_a.glb has no tool"]);
  });

  test("[R-GUIDE-013] given rows for media made outside public/assets, when they are checked, then each names a file that is there and a piece written in it, a picture's bytes are the file's, and no shipped file is asked for", () => {
    const files: Record<string, Uint8Array> = { "apps/x/art.ts": Buffer.from('const art = { "art.dusk": 1 };'), "apps/x/share/a.jpg": Uint8Array.from([1, 2, 3]) };
    const read = (path: string): Uint8Array | null => files[path] ?? null;
    const media = [row("apps/x/art.ts#art.dusk", { bytes: 0 }), row("apps/x/share/a.jpg", { bytes: 3 })];
    expect(checkMediaRows(media, read)).toEqual([]);
    expect(checkRegister(media, [])).toEqual([]);
    expect(checkMediaRows([row("apps/x/art.ts#art.dawn")], read)[0]).toMatch(/names art.dawn, which apps\/x\/art.ts does not hold/);
    expect(checkMediaRows([row("apps/x/gone.ts#art.dusk")], read)[0]).toMatch(/names no file/);
    expect(checkMediaRows([row("apps/x/share/a.jpg", { bytes: 4 })], read)[0]).toMatch(/bytes 4, the file has 3/);
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
  test("[R-ASSET-027] given a sheet scored in rounds, when the review that counts is read, then it is the last round; a place's sheet counts for no row", () => {
    const first = review({ wear: 2 });
    const second = { ...review({}), against: { file: "review.json, the first entry" } };
    expect(lastRound([first, second])).toBe(second);
    expect(lastRound(first)).toBe(first);
    expect(lastRound([])).toBeNull();
    const modes = { scores: {}, mean: 4, accepted: true, failing: [], reasons: {} };
    expect(lastRound({ piece: "the hub", reviewer: "r", date: "2026-10-08", low: modes, high: modes, notes: "" })).toBeNull();
  });

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
    // 4 + 1 + 2 signs + 3 x 17 people = 58 draw calls in low mode: inside the first load's 60.
    expect(checkPlace(place(17, 17, 2), files, budgets)).toEqual([]);
    // One more person: 61.
    expect(checkPlace(place(18, 18, 2), files, budgets)[0]).toMatch(/61 draw calls in low mode, over 60/);
  });

  test("[R-ASSET-007] given the hub, when its rows are read, then its low mode is held to the first load and its high mode to the exterior row, and any other place to its scope in both", () => {
    expect(rowFor({ hub: true, scope: "exterior" }, "low", budgets)).toBe(budgets.place.firstLoad);
    expect(rowFor({ hub: true, scope: "exterior" }, "high", budgets)).toBe(budgets.place.exterior);
    expect(rowFor({ hub: false, scope: "interior" }, "low", budgets)).toBe(budgets.place.interior);
    // 4 + 1 + 2 + 3 x 24 = 79 draw calls in high mode: over the first load's 60, inside the exterior's 80; 25 people make 82.
    expect(checkPlace(place(8, 24, 2), files, budgets)).toEqual([]);
    expect(checkPlace(place(8, 25, 2), files, budgets)[0]).toMatch(/82 draw calls in high mode, over 80/);
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
