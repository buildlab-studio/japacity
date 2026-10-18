import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { REPO_ROOT } from "../tools/repo";

const OPS = join(REPO_ROOT, "apps/server/src/ops");

function sources(): { file: string; text: string }[] {
  const files = readdirSync(OPS).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  return [...files.map((name) => join(OPS, name)), join(REPO_ROOT, "apps/server/src/routes/admin/admin.ts"), join(REPO_ROOT, "apps/server/src/jobs/money.ts")].map((file) => ({ file, text: readFileSync(file, "utf8") }));
}

describe("the admin tools' reach", () => {
  test("[R-SERVER-010] given the admin source, when it is searched, then no rollback runs in a loop, no function but the snapshot's (R-SERVER-047) lists the player store's characters, and the rollback tool reads one character at a time", () => {
    const found = sources();
    expect(found.length).toBeGreaterThan(5);
    for (const { file, text } of found) {
      const lines = text.split("\n");
      const looped = lines.filter((line) => /\b(for|while)\b|\.(map|forEach|flatMap|reduce)\(/.test(line) && /rollback(Apply|Check)\(/.test(line));
      expect({ file, looped }).toEqual({ file, looped: [] });
      expect({ file, listed: !file.endsWith("snapshot.ts") && /stores\.player\.(list|all|ids|scan|page)\b/.test(text) }).toEqual({ file, listed: false });
    }
    const rollback = readFileSync(join(OPS, "rollback.ts"), "utf8");
    expect(rollback.match(/stores\.player\.\w+/g)?.sort()).toEqual(["stores.player.load", "stores.player.log", "stores.player.transact"]);
    expect(rollback).toMatch(/transact\(\[character\]/);
  });

  test("[R-SERVER-029] given the server's readme, when the steps in the accounts are read, then the spending alerts at $50 and $200 a month are there", () => {
    const readme = readFileSync(join(REPO_ROOT, "apps/server/README.md"), "utf8");
    const steps = readme.slice(readme.indexOf("## Steps in the accounts"));
    expect(steps).toMatch(/R-SERVER-029.*\$50.*\$200 a month/);
  });
});
