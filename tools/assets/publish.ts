// pnpm assets:publish: copies every shipped file under public/assets to a name that carries the hash
// of its contents, beside its source, and writes the manifest the city's loader reads (city.md
// R-CITY-018). A file whose contents change gets a new name, so the browser may keep every published
// file for good. The build check skips the hashed copies and the manifest (check-assets.ts).
// First it copies each model's tile render to tiles/<name>.png, so the interface's pictures are
// published as the models are (design page 13, the pictures).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { CATALOG, type CatalogEntry } from "./catalog";
import { defaultPaths, isPublishedCopy, listFiles, TILES } from "./check-assets";
import { hashedName, readManifest, sha256, writeManifest } from "./manifest";

export { HASH_DIGITS, hashedName, hashInName } from "./manifest";
export { TILES } from "./check-assets";

export const MANIFEST_FILE = "manifest.json";

export interface PublishManifest {
  note: string;
  /** Path under public/assets to the hashed path beside it. */
  files: Record<string, string>;
}

/** The files a publish names: everything under public/assets but the hashed copies and the manifest itself. */
export function sourcesOf(folder: string): string[] {
  return listFiles(folder).filter((path) => path !== MANIFEST_FILE && !isPublishedCopy(path));
}

/** What a publish would write: one entry per shipped file, keyed by its path under public/assets. */
export function planPublish(folder: string): PublishManifest {
  const files: Record<string, string> = {};
  for (const path of sourcesOf(folder)) files[path] = hashedName(path, sha256(readFileSync(join(folder, path))));
  return {
    note: "Written by tools/assets/publish.ts (pnpm assets:publish). Every file under public/assets, published beside it under a name carrying the hash of its contents (city.md R-CITY-018). Never edit by hand.",
    files,
  };
}

/** Copies each file to its hashed name beside it, removes hashed copies no longer named, and writes the manifest. */
export function publish(folder: string): PublishManifest {
  const manifest = planPublish(folder);
  const keep = new Set(Object.values(manifest.files));
  for (const stale of listFiles(folder).filter((path) => isPublishedCopy(path) && !keep.has(path))) rmSync(join(folder, stale));
  for (const [path, published] of Object.entries(manifest.files)) {
    const to = join(folder, published);
    if (!existsSync(to)) copyFileSync(join(folder, path), to);
  }
  writeFileSync(join(folder, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Copies each asset's renders/tile.png to tiles/<name>.png under the folder and removes any tile no
 * asset names, its hashed copies with it. Returns each copy's hash by its path from the root, for
 * the image manifest (R-ASSET-011): a tile is a render the shooter wrote, only published.
 */
export function copyTiles(entries: readonly Pick<CatalogEntry, "name" | "source">[], root: string, folder: string, from = relative(root, folder)): Record<string, string> {
  const into = join(folder, TILES);
  mkdirSync(into, { recursive: true });
  const names = new Set(entries.map((entry) => `${entry.name}.png`));
  for (const stale of listFiles(into).filter((file) => !names.has(isPublishedCopy(file) ? file.replace(/\.[0-9a-f]+\.png$/, ".png") : file))) rmSync(join(into, stale));
  const hashes: Record<string, string> = {};
  for (const entry of entries) {
    const render = join(root, entry.source, "renders", "tile.png");
    copyFileSync(render, join(into, `${entry.name}.png`));
    hashes[`${from}/${TILES}/${entry.name}.png`] = sha256(readFileSync(render));
  }
  return hashes;
}

function main(): void {
  const root = join(import.meta.dirname, "..", "..");
  const folder = defaultPaths(root).public;
  const tiles = copyTiles(CATALOG.filter((entry) => entry.views.includes("tile")), root, folder);
  const images = readManifest();
  const prefix = `${relative(root, folder)}/${TILES}/`;
  images.renders = { ...Object.fromEntries(Object.entries(images.renders).filter(([path]) => !path.startsWith(prefix))), ...tiles };
  writeManifest(images);
  const manifest = publish(folder);
  console.log(`publish: ${String(Object.keys(manifest.files).length)} file(s) beside their sources under apps/client/public/assets`);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) main();
