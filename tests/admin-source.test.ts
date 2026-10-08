import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const ADMIN = join(root, "apps/server/src/admin");

function sources(): { file: string; text: string }[] {
  const files = readdirSync(ADMIN).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  return [...files.map((name) => join(ADMIN, name)), join(root, "apps/server/src/routes/admin.ts"), join(root, "apps/server/src/jobs/money.ts")].map((file) => ({ file, text: readFileSync(file, "utf8") }));
}

describe("the admin tools' reach", () => {
  test("[R-SERVER-010] given the admin source, when it is searched, then no rollback runs in a loop, no function lists the player store's characters, and the rollback tool reads one character at a time", () => {
    const found = sources();
    expect(found.length).toBeGreaterThan(5);
    for (const { file, text } of found) {
      const lines = text.split("\n");
      const looped = lines.filter((line) => /\b(for|while)\b|\.(map|forEach|flatMap|reduce)\(/.test(line) && /rollback(Apply|Check)\(/.test(line));
      expect(looped, file).toEqual([]);
      expect(text, file).not.toMatch(/stores\.player\.(list|all|ids|scan)\b/);
    }
    const rollback = readFileSync(join(ADMIN, "rollback.ts"), "utf8");
    expect(rollback.match(/stores\.player\.\w+/g)?.sort()).toEqual(["stores.player.load", "stores.player.log", "stores.player.transact"]);
    expect(rollback).toMatch(/transact\(\[character\]/);
  });

  test("[R-SERVER-029] given the server's readme, when the maintainer's steps are read, then the spending alerts at $50 and $200 a month are there", () => {
    const readme = readFileSync(join(root, "apps/server/README.md"), "utf8");
    const steps = readme.slice(readme.indexOf("## Steps only the maintainer can do"));
    expect(steps).toMatch(/R-SERVER-029.*\$50.*\$200 a month/);
  });
});
