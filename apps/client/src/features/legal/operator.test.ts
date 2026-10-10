import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { OPERATOR } from "@japacity/content";
import { describe, expect, test } from "vitest";

// docs/rules/region.md, "Who runs the game": the operator's name and place live
// in one constant, so a change of operator is a change to that one line.
const root = process.cwd();
const CONSTANT = "packages/content/src/legal/legal.operator.ts";

/** The files git would publish under apps/ and packages/: tracked ones, and new ones that are not ignored. */
function published(): string[] {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "apps", "packages"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return [...new Set(output.split("\u0000").filter((path) => path !== ""))];
}

const loose = (words: string) => new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`).replace(/[\s-]+/g, String.raw`[\s-]*`), "i");
const surname = OPERATOR.name.split(/\s+/).at(-1) ?? OPERATOR.name;
const SPELLINGS = [OPERATOR.name, surname, OPERATOR.place].map(loose);

describe("who runs the game", () => {
  const files = published();

  test("[R-REGION-010] given the repository, then the walk sees the constant and the two page templates", () => {
    expect(files).toContain(CONSTANT);
    expect(files).toContain("apps/client/src/features/legal/terms.html");
    expect(files).toContain("apps/client/src/features/legal/privacy.html");
  });

  test("[R-REGION-010] given every file in apps/ and packages/ but the constant, when it is read, then none spells the operator's name or place", () => {
    const found: string[] = [];
    for (const file of files) {
      if (file === CONSTANT) continue;
      let body: string;
      try {
        body = readFileSync(join(root, file), "utf8");
      } catch {
        // Listed by git but gone from the disk: a deletion not yet committed.
        continue;
      }
      if (body.includes("\u0000")) continue;
      for (const spelling of SPELLINGS) if (spelling.test(body)) found.push(`${file}: ${spelling.source}`);
    }
    expect(found).toEqual([]);
  });

  test("[R-REGION-010] given the constant, then it names who runs the game, a place in Nigeria with no street, and one address on japacity.app", () => {
    expect(OPERATOR.name.trim()).not.toBe("");
    expect(OPERATOR.place).toMatch(/^[^,\d]+, [^,\d]+, Nigeria$/);
    expect(OPERATOR.email).toMatch(/^[a-z]+@japacity\.app$/);
  });
});
