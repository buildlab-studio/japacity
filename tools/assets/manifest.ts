// The manifest of every image the tools wrote (assets:no-reference-photos-kept): renders from the shooter and patterns
// from the pattern builder, each with its hash. Any other image under models or public/assets
// fails the check, which is how a reference photo is kept out of the repository.
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { SOURCE } from "./catalog";
import { readJson } from "../repo";

export interface Manifest {
  note: string;
  renders: Record<string, string>;
  patterns: Record<string, string>;
}

const MANIFEST_PATH = join(SOURCE, "manifest.json");

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** How many hex digits of the SHA-256 a published name keeps: 48 bits, ample for a few hundred files. */
export const HASH_DIGITS = 12;

/** `places/ojuelegba/bld_plaza.glb` with hash `ab12...` is published as `places/ojuelegba/bld_plaza.ab12....glb` (city:places-load-on-entry). */
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

export function readManifest(path = MANIFEST_PATH): Manifest {
  if (!existsSync(path)) {
    return {
      note: "Every image under models and apps/client/public/assets, with its SHA-256: renders written by tools/assets/shoot.ts and patterns written by the pattern builder (assets:no-reference-photos-kept). No other image may be there.",
      renders: {},
      patterns: {},
    };
  }
  return readJson<Manifest>(path);
}

export function writeManifest(manifest: Manifest, path = MANIFEST_PATH): void {
  const sorted = (record: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, `${JSON.stringify({ ...manifest, renders: sorted(manifest.renders), patterns: sorted(manifest.patterns) }, null, 2)}\n`);
}
