// pnpm assets:publish: copies every shipped file under public/assets to a name that carries the hash
// of its contents, and writes the manifest the city's loader reads (city.md R-CITY-018). A file whose
// contents change gets a new name, so the browser may keep every published file for good.
// The copies sit beside public/assets, not inside it: the build check holds every name in there to
// R-ASSET-008 and a register row, which a hashed copy has neither of.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { defaultPaths, listFiles } from "./check-assets";
import { sha256 } from "./manifest";

/** How many hex digits of the SHA-256 a published name keeps: 48 bits, ample for a few hundred files. */
export const HASH_DIGITS = 12;
export const MANIFEST_FILE = "manifest.json";

export interface PublishManifest {
  note: string;
  /** Path under public/assets to path under the published folder. */
  files: Record<string, string>;
}

/** `places/ojuelegba/bld_plaza.glb` with hash `ab12...` becomes `places/ojuelegba/bld_plaza.ab12....glb`. */
export function hashedName(path: string, hash: string): string {
  const short = hash.slice(0, HASH_DIGITS);
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot <= slash + 1) return `${path}.${short}`;
  return `${path.slice(0, dot)}.${short}${path.slice(dot)}`;
}

/** The hash a published name carries, or null when it carries none. */
export function hashInName(published: string): string | null {
  const match = new RegExp(`\\.([0-9a-f]{${String(HASH_DIGITS)}})(\\.[a-z0-9]+)?$`).exec(published);
  return match?.[1] ?? null;
}

export function publishedFolder(root: string): string {
  return join(root, "apps", "client", "public", "published");
}

/** What a publish would write: one entry per shipped file, keyed by its path under public/assets. */
export function planPublish(source: string): PublishManifest {
  const files: Record<string, string> = {};
  for (const path of listFiles(source)) files[path] = hashedName(path, sha256(readFileSync(join(source, path))));
  return {
    note: "Written by tools/assets/publish.ts (pnpm assets:publish). Every file under public/assets, published under a name carrying the hash of its contents (city.md R-CITY-018). Never edit by hand.",
    files,
  };
}

/** Copies the files, removes published files no longer named, and writes the manifest. */
export function publish(source: string, target: string): PublishManifest {
  const manifest = planPublish(source);
  const keep = new Set([MANIFEST_FILE, ...Object.values(manifest.files)]);
  for (const stale of listFiles(target).filter((path) => !keep.has(path))) rmSync(join(target, stale));
  for (const [path, published] of Object.entries(manifest.files)) {
    const to = join(target, published);
    if (existsSync(to)) continue;
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(source, path), to);
  }
  writeFileSync(join(target, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function main(): void {
  const root = join(import.meta.dirname, "..", "..");
  const manifest = publish(defaultPaths(root).public, publishedFolder(root));
  console.log(`publish: ${String(Object.keys(manifest.files).length)} file(s) under apps/client/public/published`);
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) main();
