// The credits link the licences file the build writes beside the page (guides.md R-GUIDE-010). The link takes its path
// from content, never from the build's own code, which reads the disk through Node: a page that imported that code would
// fail to open in development, where Vite refuses Node's modules in the browser, and the front door would never open.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { LICENCES_PATH } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { LICENCES_FILE } from "./shipping.plugin";

const SRC = join(import.meta.dirname, "..", "src");
const SPECIFIER = /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** A relative specifier as the file it names, or null for a package's. */
function resolved(from: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(from), specifier.replace(/\?.*$/, ""));
  for (const file of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(file) && /\.(?:ts|tsx)$/.test(file)) return file;
  }
  return null;
}

/** Every source module the page can load, statically or later, from its entry. */
function pageModules(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
      const next = resolved(file, match[1] ?? match[2] ?? "");
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

describe("the licences file's name", () => {
  test("[R-GUIDE-010] given the credits' link and the build that writes the file, when both name it, then it is the one file beside the page", () => {
    expect(LICENCES_FILE).toBe("licenses.txt");
    expect(LICENCES_PATH).toBe(`/${LICENCES_FILE}`);
  });

  test("[R-GUIDE-010] given the page from its entry, when every module it can load is read, then none imports Node's own modules, so the credits and the rest open in development", () => {
    const modules = pageModules(join(SRC, "main.tsx"));
    expect(modules.size).toBeGreaterThan(200);
    expect([...modules].some((file) => file.endsWith(join("city", "Credits.tsx")))).toBe(true);
    const node = [...modules].filter((file) => /from\s+["']node:/.test(readFileSync(file, "utf8"))).map((file) => file.slice(SRC.length + 1));
    expect(node).toEqual([]);
  });
});
