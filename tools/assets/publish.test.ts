import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { defaultPaths, listFiles } from "./check-assets";
import { sha256 } from "./manifest";
import { hashedName, hashInName, HASH_DIGITS, MANIFEST_FILE, planPublish, publish, publishedFolder, type PublishManifest } from "./publish";

const ROOT = join(import.meta.dirname, "..", "..");

describe("published names", () => {
  test("[R-CITY-018] given a shipped path and its hash, when it is named for publishing, then the hash sits before the extension and can be read back", () => {
    const hash = "0123456789abcdef0123";
    const name = hashedName("places/ojuelegba/bld_plaza.glb", hash);
    expect(name).toBe("places/ojuelegba/bld_plaza.0123456789ab.glb");
    expect(hashInName(name)).toBe(hash.slice(0, HASH_DIGITS));
    expect(hashInName("places/ojuelegba/bld_plaza.glb")).toBeNull();
  });

  test("[R-CITY-018] given two files, when one changes, then only its published name changes and the old copy is removed", () => {
    const work = mkdtempSync(join(tmpdir(), "publish-"));
    try {
      const source = join(work, "assets");
      const target = join(work, "published");
      mkdirSync(join(source, "shared"), { recursive: true });
      writeFileSync(join(source, "shared", "prop_a.glb"), "one");
      writeFileSync(join(source, "credits.json"), "{}");
      const first = publish(source, target);
      writeFileSync(join(source, "shared", "prop_a.glb"), "two");
      const second = publish(source, target);
      expect(second.files["credits.json"]).toBe(first.files["credits.json"]);
      expect(second.files["shared/prop_a.glb"]).not.toBe(first.files["shared/prop_a.glb"]);
      expect(existsSync(join(target, first.files["shared/prop_a.glb"] ?? ""))).toBe(false);
      expect(readFileSync(join(target, second.files["shared/prop_a.glb"] ?? ""), "utf8")).toBe("two");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe("the committed publish", () => {
  const source = defaultPaths(ROOT).public;
  const target = publishedFolder(ROOT);
  const manifest = JSON.parse(readFileSync(join(target, MANIFEST_FILE), "utf8")) as PublishManifest;

  test("[R-CITY-018] given the manifest the loader reads, when each name is checked, then it carries the hash of that file's contents", () => {
    const wrong = Object.entries(manifest.files).filter(([, published]) => {
      const bytes = readFileSync(join(target, published));
      return hashInName(published) !== sha256(bytes).slice(0, HASH_DIGITS);
    });
    expect(wrong).toEqual([]);
  });

  test("[R-CITY-018] given every shipped file, when the manifest is compared with public/assets, then it names each one with its current contents", () => {
    expect(manifest.files).toEqual(planPublish(source).files);
    const published = new Set([MANIFEST_FILE, ...Object.values(manifest.files)]);
    expect(listFiles(target).filter((path) => !published.has(path))).toEqual([]);
  });
});
