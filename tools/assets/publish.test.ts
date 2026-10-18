import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { CATALOG, isTiled } from "./catalog";
import { defaultPaths } from "./assets-check";
import { readManifest, sha256 } from "./manifest";
import { copyTiles, hashedName, hashInName, HASH_DIGITS, MANIFEST_FILE, planPublish, publish, type PublishManifest, sourcesOf, tileName, tilePictures, TILES } from "./publish";
import { filesUnder, readJson, REPO_ROOT } from "../repo";

describe("published names", () => {
  test("[R-CITY-018] given a shipped path and its hash, when it is named for publishing, then the hash sits before the extension and can be read back", () => {
    const hash = "0123456789abcdef0123";
    const name = hashedName("places/ojuelegba/bld_plaza.glb", hash);
    expect(name).toBe("places/ojuelegba/bld_plaza.0123456789ab.glb");
    expect(hashInName(name)).toBe(hash.slice(0, HASH_DIGITS));
    expect(hashInName("places/ojuelegba/bld_plaza.glb")).toBeNull();
  });

  test("[R-CITY-018] given two files, when one changes, then only its published name changes, the old copy is removed and the sources stay", () => {
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
  test("[R-CITY-018] given assets with a tile render, when the tiles are copied, then each lands under tiles by the asset's name, a tile no asset names is removed, and the image manifest learns each copy's hash", () => {
    const work = mkdtempSync(join(tmpdir(), "tiles-"));
    try {
      const folder = join(work, "public");
      for (const name of ["a", "b"]) {
        mkdirSync(join(work, "src", name, "renders"), { recursive: true });
        writeFileSync(join(work, "src", name, "renders", "tile.png"), `tile ${name}`);
      }
      mkdirSync(join(folder, TILES), { recursive: true });
      writeFileSync(join(folder, TILES, "prop_gone.png"), "old");
      writeFileSync(join(folder, TILES, "prop_gone.0123456789ab.png"), "old");
      const hashes = copyTiles([{ name: "prop_a", source: "src/a" }, { name: "veh_b", source: "src/b" }], work, folder, "public");
      expect(filesUnder(join(folder, TILES))).toEqual(["prop_a.png", "veh_b.png"]);
      expect(readFileSync(join(folder, TILES, "veh_b.png"), "utf8")).toBe("tile b");
      expect(hashes).toEqual({ "public/tiles/prop_a.png": sha256(Buffer.from("tile a")), "public/tiles/veh_b.png": sha256(Buffer.from("tile b")) });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("the door's portraits", () => {
  test("[R-CITY-018] [R-ASSET-011] given a look with its face, figure and cheer renders, when the tiles are copied, then each lands under tiles as the look's name and the view's, beside the things' tiles", () => {
    const work = mkdtempSync(join(tmpdir(), "portraits-"));
    try {
      const folder = join(work, "public");
      mkdirSync(join(work, "src", "ada", "renders"), { recursive: true });
      for (const view of ["face", "figure", "cheer"]) writeFileSync(join(work, "src", "ada", "renders", `${view}.png`), `${view} ada`);
      mkdirSync(join(work, "src", "a", "renders"), { recursive: true });
      writeFileSync(join(work, "src", "a", "renders", "tile.png"), "tile a");
      const pictures = tilePictures([
        { name: "prop_a", source: "src/a", views: ["front", "tile"] },
        { name: "chr_ada", source: "src/ada", views: ["front", "phone", "face", "figure", "cheer"] },
        { name: "chr_hawker", source: "src/hawker", views: ["front", "phone"] },
      ]);
      expect(pictures.map(tileName)).toEqual(["prop_a", "chr_ada-face", "chr_ada-figure", "chr_ada-cheer"]);
      const hashes = copyTiles(pictures, work, folder, "public");
      expect(filesUnder(join(folder, TILES))).toEqual(["chr_ada-cheer.png", "chr_ada-face.png", "chr_ada-figure.png", "prop_a.png"]);
      expect(readFileSync(join(folder, TILES, "chr_ada-figure.png"), "utf8")).toBe("figure ada");
      expect(hashes["public/tiles/chr_ada-face.png"]).toBe(sha256(Buffer.from("face ada")));
      // A portrait's name never reads as a published copy's hash.
      expect(hashInName("chr_ada-face.png")).toBeNull();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("the committed publish", () => {
  const folder = defaultPaths(REPO_ROOT).public;
  const manifest = readJson<PublishManifest>(join(folder, MANIFEST_FILE));

  test("[R-CITY-018] given the manifest the loader reads, when each name is checked, then it carries the hash of that file's contents", () => {
    const wrong = Object.entries(manifest.files).filter(([, published]) => {
      const bytes = readFileSync(join(folder, published));
      return hashInName(published) !== sha256(bytes).slice(0, HASH_DIGITS);
    });
    expect(wrong).toEqual([]);
  });

  test("[R-CITY-018] given every shipped file, when the manifest is compared with public/assets, then it names each one with its current contents, beside it, and no stale copy is left", () => {
    expect(manifest.files).toEqual(planPublish(folder).files);
    for (const [path, published] of Object.entries(manifest.files)) expect(published.slice(0, published.lastIndexOf("/") + 1)).toBe(path.slice(0, path.lastIndexOf("/") + 1));
    const named = new Set([MANIFEST_FILE, ...Object.keys(manifest.files), ...Object.values(manifest.files)]);
    expect(filesUnder(folder).filter((path) => !named.has(path))).toEqual([]);
    expect(sourcesOf(folder)).toEqual(Object.keys(manifest.files));
  });

  test("[R-CITY-018] [R-ASSET-011] given every model with a tile, when the publish is read, then its tile is published by its name with the render's bytes, and the image manifest knows the copy", () => {
    const images = readManifest().renders;
    const tiled = CATALOG.filter((entry) => isTiled(entry.name));
    const wrong = tiled.filter((entry) => {
      const published = manifest.files[`${TILES}/${entry.name}.png`];
      if (published === undefined) return true;
      const render = readFileSync(join(REPO_ROOT, entry.source, "renders", "tile.png"));
      return sha256(readFileSync(join(folder, published))) !== sha256(render) || images[`apps/client/public/assets/${TILES}/${entry.name}.png`] !== sha256(render);
    });
    expect(wrong.map((entry) => entry.name)).toEqual([]);
    // Beside the things' tiles, the door's looks' portraits (face, figure and cheer for each look), and nothing else.
    const portraits = tilePictures(CATALOG).filter((picture) => picture.view !== undefined);
    expect(portraits).toHaveLength(48);
    const unpublished = portraits.filter((picture) => {
      const published = manifest.files[`${TILES}/${tileName(picture)}.png`];
      if (published === undefined) return true;
      const render = readFileSync(join(REPO_ROOT, picture.source, "renders", `${picture.view ?? "tile"}.png`));
      return sha256(readFileSync(join(folder, published))) !== sha256(render) || images[`apps/client/public/assets/${TILES}/${tileName(picture)}.png`] !== sha256(render);
    });
    expect(unpublished.map(tileName)).toEqual([]);
    expect(Object.keys(manifest.files).filter((path) => path.startsWith(`${TILES}/`))).toHaveLength(tiled.length + portraits.length);
  });
});
