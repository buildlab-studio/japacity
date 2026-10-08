import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { defaultPaths, listFiles } from "./check-assets";
import { sha256 } from "./manifest";
import { hashedName, hashInName, HASH_DIGITS, MANIFEST_FILE, planPublish, publish, type PublishManifest, sourcesOf } from "./publish";

const ROOT = join(import.meta.dirname, "..", "..");

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

describe("the committed publish", () => {
  const folder = defaultPaths(ROOT).public;
  const manifest = JSON.parse(readFileSync(join(folder, MANIFEST_FILE), "utf8")) as PublishManifest;

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
    expect(listFiles(folder).filter((path) => !named.has(path))).toEqual([]);
    expect(sourcesOf(folder)).toEqual(Object.keys(manifest.files));
  });
});
