// What a test's vi.mock of shared/three/manifest returns. vi.mock runs before
// the file's imports, so its factory reaches this file through `await import(...)`:
// vi.mock("../shared/three/manifest", async (original) => (await import("../shared/testing/manifest")).fromDisk(original));
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type * as Manifest from "../three/manifest";

type ManifestModule = typeof Manifest;
type Original = <T>() => Promise<T>;

const ASSETS = join(import.meta.dirname, "..", "..", "..", "public", "assets");

/** The real module with a manifest that names no file, so nothing is fetched. */
export async function emptyManifest(original: Original): Promise<ManifestModule> {
  return { ...(await original<ManifestModule>()), loadManifest: () => Promise.resolve({ files: {} }) };
}

/** The empty manifest, with each JSON file read from the shipped assets on the disk in place of the server. */
export async function fromDisk(original: Original): Promise<ManifestModule> {
  return {
    ...(await emptyManifest(original)),
    loadJson: <T>(_manifest: Manifest.PublishManifest, under: string): Promise<T | null> => {
      const file = join(ASSETS, under);
      return Promise.resolve(existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);
    },
  };
}
