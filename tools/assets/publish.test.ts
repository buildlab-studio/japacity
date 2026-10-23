import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

import { CATALOG, isPostered, isTiled } from "./catalog";
import { defaultPaths } from "./assets-check";
import { readManifest, sha256 } from "./manifest";
import { drawnFrom, SMALL, toWebp, webpProblem } from "./webp";
import { discRender } from "./webp.testing";
import { encodeTiles, hashedName, hashInName, HASH_DIGITS, MANIFEST_FILE, planPublish, publish, type PublishManifest, sourcesOf, tileFiles, tileName, type TilePicture, tilePictures, TILES } from "./publish";
import { filesUnder, readJson, REPO_ROOT } from "../repo";

describe("published names", () => {
  test("[city:places-load-on-entry] given a shipped path and its hash, when it is named for publishing, then the hash sits before the extension and can be read back", () => {
    const hash = "0123456789abcdef0123";
    const name = hashedName("places/ojuelegba/building_plaza.glb", hash);
    expect(name).toBe("places/ojuelegba/building_plaza.0123456789ab.glb");
    expect(hashInName(name)).toBe(hash.slice(0, HASH_DIGITS));
    expect(hashInName("places/ojuelegba/building_plaza.glb")).toBeNull();
  });

  test("[city:places-load-on-entry] given two files, when one changes, then only its published name changes, the old copy is removed and the sources stay", () => {
    const work = mkdtempSync(join(tmpdir(), "publish-"));
    try {
      const folder = join(work, "assets");
      mkdirSync(join(folder, "shared"), { recursive: true });
      writeFileSync(join(folder, "shared", "prop_a.glb"), "one");
      writeFileSync(join(folder, "credits.json"), "{}");
      const first = publish(folder);
      writeFileSync(join(folder, "shared", "prop_a.glb"), "two");
      const second = publish(folder);
      expect(second.files["credits.json"]).toBe(first.files["credits.json"]);
      expect(second.files["shared/prop_a.glb"]).not.toBe(first.files["shared/prop_a.glb"]);
      expect(existsSync(join(folder, first.files["shared/prop_a.glb"] ?? ""))).toBe(false);
      expect(readFileSync(join(folder, second.files["shared/prop_a.glb"] ?? ""), "utf8")).toBe("two");
      expect(readFileSync(join(folder, "shared", "prop_a.glb"), "utf8")).toBe("two");
      expect(Object.keys(second.files).sort()).toEqual(["credits.json", "shared/prop_a.glb"]);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("the tiles", () => {
  test("[city:places-load-on-entry] [assets:pictures-shipped-light] [assets:pictures-sharp-at-three] given assets with a tile render, when the tiles are published, then each lands under tiles by the asset's name as WebP at its own size and the small size, anything no asset names is removed, and the image manifest learns each picture's hash", async () => {
    const work = mkdtempSync(join(tmpdir(), "tiles-"));
    try {
      const folder = join(work, "public");
      const renders = { a: await discRender(512, 512), b: await discRender(512, 512, "#1f8a4c") };
      for (const [name, render] of Object.entries(renders)) {
        mkdirSync(join(work, "src", name, "renders"), { recursive: true });
        writeFileSync(join(work, "src", name, "renders", "tile.png"), render);
      }
      mkdirSync(join(folder, TILES), { recursive: true });
      for (const stale of ["prop_gone.png", "prop_gone.0123456789ab.png", "prop_a.png", "prop_a.0123456789ab.png", "prop_gone.webp"]) writeFileSync(join(folder, TILES, stale), "old");
      const hashes = await encodeTiles([{ name: "prop_a", source: "src/a" }, { name: "vehicle_b", source: "src/b" }], work, folder, "public");
      expect(filesUnder(join(folder, TILES))).toEqual(["prop_a-small.webp", "prop_a.webp", "vehicle_b-small.webp", "vehicle_b.webp"]);
      const b = readFileSync(join(folder, TILES, "vehicle_b.webp"));
      const bSmall = readFileSync(join(folder, TILES, "vehicle_b-small.webp"));
      expect(b).toEqual(await toWebp(renders.b));
      expect(bSmall).toEqual(await toWebp(renders.b, true));
      expect(await drawnFrom(b, renders.b)).toBeNull();
      expect(await drawnFrom(bSmall, renders.b, true)).toBeNull();
      expect(bSmall.byteLength).toBeLessThan(b.byteLength);
      expect(hashes).toEqual({
        "public/tiles/prop_a.webp": sha256(readFileSync(join(folder, TILES, "prop_a.webp"))),
        "public/tiles/prop_a-small.webp": sha256(readFileSync(join(folder, TILES, "prop_a-small.webp"))),
        "public/tiles/vehicle_b.webp": sha256(b),
        "public/tiles/vehicle_b-small.webp": sha256(bSmall),
      });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("the door's portraits", () => {
  test("[city:places-load-on-entry] [assets:no-reference-photos-kept] [assets:pictures-shipped-light] given a look with its face, figure and cheer renders, when the tiles are published, then each lands under tiles as WebP by the look's name and the view's, at its one size, beside the things' tiles", async () => {
    const work = mkdtempSync(join(tmpdir(), "portraits-"));
    try {
      const folder = join(work, "public");
      mkdirSync(join(work, "src", "ada", "renders"), { recursive: true });
      const face = await discRender(256, 256);
      writeFileSync(join(work, "src", "ada", "renders", "face.png"), face);
      for (const view of ["figure", "cheer"]) writeFileSync(join(work, "src", "ada", "renders", `${view}.png`), await discRender(600, 1200));
      mkdirSync(join(work, "src", "a", "renders"), { recursive: true });
      writeFileSync(join(work, "src", "a", "renders", "tile.png"), await discRender(512, 512));
      const pictures = tilePictures([
        { name: "prop_a", source: "src/a", views: ["front", "tile"] },
        { name: "person_ada", source: "src/ada", views: ["front", "phone", "face", "figure", "cheer"] },
        { name: "person_hawker", source: "src/hawker", views: ["front", "phone"] },
      ]);
      expect(pictures.map(tileName)).toEqual(["prop_a", "person_ada-face", "person_ada-figure", "person_ada-cheer"]);
      expect(pictures.map((picture) => tileFiles(picture).map((one) => one.file))).toEqual([["prop_a.webp", "prop_a-small.webp"], ["person_ada-face.webp"], ["person_ada-figure.webp"], ["person_ada-cheer.webp"]]);
      const hashes = await encodeTiles(pictures, work, folder, "public");
      expect(filesUnder(join(folder, TILES))).toEqual(["person_ada-cheer.webp", "person_ada-face.webp", "person_ada-figure.webp", "prop_a-small.webp", "prop_a.webp"]);
      const published = readFileSync(join(folder, TILES, "person_ada-face.webp"));
      expect(await drawnFrom(published, face)).toBeNull();
      expect(hashes["public/tiles/person_ada-face.webp"]).toBe(sha256(published));
      // A portrait's name never reads as a published copy's hash.
      expect(hashInName("person_ada-face.webp")).toBeNull();
      expect(hashInName("prop_a-small.webp")).toBeNull();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("the committed publish", () => {
  const folder = defaultPaths(REPO_ROOT).public;
  const manifest = readJson<PublishManifest>(join(folder, MANIFEST_FILE));

  test("[assets:pictures-shipped-light] given the pictures published under public/assets/tiles, when their kinds are read, then none is a PNG and every one is a lossy WebP with its transparency whole", () => {
    const shipped = filesUnder(join(folder, TILES));
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped.filter((file) => file.toLowerCase().endsWith(".png"))).toEqual([]);
    expect(shipped.filter((file) => !file.endsWith(".webp"))).toEqual([]);
    expect(shipped.map((file) => ({ file, problem: webpProblem(readFileSync(join(folder, TILES, file))) })).filter((one) => one.problem !== null)).toEqual([]);
  });

  test("[city:places-load-on-entry] given the manifest the loader reads, when each name is checked, then it carries the hash of that file's contents", () => {
    const wrong = Object.entries(manifest.files).filter(([, published]) => {
      const bytes = readFileSync(join(folder, published));
      return hashInName(published) !== sha256(bytes).slice(0, HASH_DIGITS);
    });
    expect(wrong).toEqual([]);
  });

  test("[city:places-load-on-entry] given every shipped file, when the manifest is compared with public/assets, then it names each one with its current contents, beside it, and no stale copy is left", () => {
    expect(manifest.files).toEqual(planPublish(folder).files);
    for (const [path, published] of Object.entries(manifest.files)) expect(published.slice(0, published.lastIndexOf("/") + 1)).toBe(path.slice(0, path.lastIndexOf("/") + 1));
    const named = new Set([MANIFEST_FILE, ...Object.keys(manifest.files), ...Object.values(manifest.files)]);
    expect(filesUnder(folder).filter((path) => !named.has(path))).toEqual([]);
    expect(sourcesOf(folder)).toEqual(Object.keys(manifest.files));
  });

  test("[city:places-load-on-entry] [assets:no-reference-photos-kept] [assets:pictures-shipped-light] given every model with a tile, when the publish is read, then its tile is published by its name as WebP drawn from the render, at its own size and the small size, and the image manifest knows each", async () => {
    const images = readManifest().renders;
    const tiled = CATALOG.filter((entry) => isTiled(entry.name));
    // Beside the things' tiles, the door's looks' portraits (face, figure and cheer for each look), the send-off's posters, and nothing else.
    const portraits = tilePictures(CATALOG).filter((picture) => picture.view !== undefined);
    expect(portraits.filter((picture) => picture.view !== "poster")).toHaveLength(48);
    expect(portraits.filter((picture) => picture.view === "poster").map((picture) => picture.name)).toEqual(CATALOG.filter((entry) => isPostered(entry.name)).map((entry) => entry.name));
    const wrong: string[] = [];
    const pictures: TilePicture[] = [...tiled.map((entry) => ({ name: entry.name, source: entry.source })), ...portraits];
    for (const picture of pictures) {
      const render = readFileSync(join(REPO_ROOT, picture.source, "renders", `${picture.view ?? "tile"}.png`));
      for (const { file, small } of tileFiles(picture)) {
        const published = manifest.files[`${TILES}/${file}`];
        if (published === undefined) {
          wrong.push(`${file} is not published`);
          continue;
        }
        const bytes = readFileSync(join(folder, published));
        const drawn = await drawnFrom(bytes, render, small);
        if (drawn !== null) wrong.push(`${file} ${drawn}`);
        if (images[`apps/client/public/assets/${TILES}/${file}`] !== sha256(bytes)) wrong.push(`${file} is not in the image manifest with its hash`);
      }
    }
    expect(wrong).toEqual([]);
    expect(Object.keys(manifest.files).filter((path) => path.startsWith(`${TILES}/`))).toHaveLength(tiled.length * 2 + portraits.length);
  });

  test("[assets:pictures-sharp-at-three] given a tile's small size, when it is read, then it is the small width across, three times the largest box a small tile fills", async () => {
    const small = manifest.files[`${TILES}/prop_radio-small.webp`] ?? "";
    expect((await sharp(readFileSync(join(folder, small))).metadata()).width).toBe(SMALL.width);
    expect(SMALL.width).toBe(3 * 64);
  });
});
