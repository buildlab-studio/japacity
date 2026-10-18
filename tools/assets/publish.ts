// pnpm assets:publish: copies every shipped file under public/assets to a name that carries the hash
// of its contents, beside its source, and writes the manifest the city's loader reads (city.md
// R-CITY-018). A file whose contents change gets a new name, so the browser may keep every published
// file for good. The build check skips the hashed copies and the manifest (assets-check.ts).
// First it copies each model's tile render to tiles/<name>.png, and each look's portraits to
// tiles/<name>-face.png, -figure.png and -cheer.png, so the interface's pictures are published as
// the models are (design page 13, the pictures; the front door's faces and figures).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { CATALOG, type CatalogEntry, PORTRAITS, type ViewName } from "./catalog";
import { defaultPaths, isPublishedCopy, TILES } from "./assets-check";
import { hashedName, readManifest, sha256, writeManifest } from "./manifest";
import { filesUnder, isMain, REPO_ROOT } from "../repo";

export { HASH_DIGITS, hashedName, hashInName } from "./manifest";
export { TILES } from "./assets-check";

export const MANIFEST_FILE = "manifest.json";

export interface PublishManifest {
  note: string;
  /** Path under public/assets to the hashed path beside it. */
  files: Record<string, string>;
}

/** The files a publish names: everything under public/assets but the hashed copies and the manifest itself. */
export function sourcesOf(folder: string): string[] {
  return filesUnder(folder).filter((path) => path !== MANIFEST_FILE && !isPublishedCopy(path));
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
  for (const stale of filesUnder(folder).filter((path) => isPublishedCopy(path) && !keep.has(path))) rmSync(join(folder, stale));
  for (const [path, published] of Object.entries(manifest.files)) {
    const to = join(folder, published);
    if (!existsSync(to)) copyFileSync(join(folder, path), to);
  }
  writeFileSync(join(folder, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/** A picture published under tiles: the asset, the view it is a render of (the tile when left out). */
export interface TilePicture {
  name: string;
  source: string;
  view?: ViewName;
}

/** The name a picture is published under: the asset's own for its tile, `<asset>-<view>` for a portrait. */
export function tileName(picture: Pick<TilePicture, "name" | "view">): string {
  return picture.view === undefined || picture.view === "tile" ? picture.name : `${picture.name}-${picture.view}`;
}

/** Every picture the catalog publishes under tiles: each model's tile, and each look's portraits. */
export function tilePictures(entries: readonly Pick<CatalogEntry, "name" | "source" | "views">[]): TilePicture[] {
  return entries.flatMap((entry) => [
    ...(entry.views.includes("tile") ? [{ name: entry.name, source: entry.source }] : []),
    ...PORTRAITS.filter((view) => entry.views.includes(view)).map((view) => ({ name: entry.name, source: entry.source, view })),
  ]);
}

/**
 * Copies each asset's renders/<view>.png (the tile's by default) to tiles/<name>.png under the folder
 * and removes any tile no asset names, its hashed copies with it. Returns each copy's hash by its path
 * from the root, for the image manifest (R-ASSET-011): a tile is a render the shooter wrote, only published.
 */
export function copyTiles(entries: readonly TilePicture[], root: string, folder: string, from = relative(root, folder)): Record<string, string> {
  const into = join(folder, TILES);
  mkdirSync(into, { recursive: true });
  const names = new Set(entries.map((entry) => `${tileName(entry)}.png`));
  for (const stale of filesUnder(into).filter((file) => !names.has(isPublishedCopy(file) ? file.replace(/\.[0-9a-f]+\.png$/, ".png") : file))) rmSync(join(into, stale));
  const hashes: Record<string, string> = {};
  for (const entry of entries) {
    const render = join(root, entry.source, "renders", `${entry.view ?? "tile"}.png`);
    copyFileSync(render, join(into, `${tileName(entry)}.png`));
    hashes[`${from}/${TILES}/${tileName(entry)}.png`] = sha256(readFileSync(render));
  }
  return hashes;
}

function main(): void {
  const folder = defaultPaths(REPO_ROOT).public;
  const tiles = copyTiles(tilePictures(CATALOG), REPO_ROOT, folder);
  const images = readManifest();
  const prefix = `${relative(REPO_ROOT, folder)}/${TILES}/`;
  images.renders = { ...Object.fromEntries(Object.entries(images.renders).filter(([path]) => !path.startsWith(prefix))), ...tiles };
  writeManifest(images);
  const manifest = publish(folder);
  console.log(`publish: ${String(Object.keys(manifest.files).length)} file(s) beside their sources under apps/client/public/assets`);
}

if (isMain(import.meta.url)) main();
