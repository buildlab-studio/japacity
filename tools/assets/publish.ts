// pnpm assets:publish: copies every shipped file under public/assets to a name that carries the hash
// of its contents, beside its source, and writes the manifest the city's loader reads (city.md
// R-CITY-018). A file whose contents change gets a new name, so the browser may keep every published
// file for good. The build check skips the hashed copies and the manifest (check-assets.ts).
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { defaultPaths, isPublishedCopy, listFiles } from "./check-assets";
import { hashedName, sha256 } from "./manifest";

export { HASH_DIGITS, hashedName, hashInName } from "./manifest";

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

function main(): void {
  const root = join(import.meta.dirname, "..", "..");
  const manifest = publish(defaultPaths(root).public);
  console.log(`publish: ${String(Object.keys(manifest.files).length)} file(s) beside their sources under apps/client/public/assets`);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) main();
