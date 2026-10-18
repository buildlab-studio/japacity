// R-SERVER-038: no stale shell. The page is always asked about again, the hashed files are kept for a year, the
// service worker keeps nothing, and every build says which it is.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { buildCommit, buildStamp } from "../../../vite/stamp.plugin";
import { buildOf, sayBuild, STAMP_META } from "./stamp";

const PUBLIC = join(import.meta.dirname, "../../../public");

interface Rule {
  pattern: string;
  set: [string, string][];
  unset: string[];
}

/** The `_headers` file's rules, in order, as the platform reads them: a path line, then indented headers; `! Name` detaches. */
function rules(text: string): Rule[] {
  const read: Rule[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      read.push({ pattern: line.trim(), set: [], unset: [] });
      continue;
    }
    const rule = read.at(-1);
    if (rule === undefined) throw new Error(`A header before any path: ${line}`);
    const header = line.trim();
    if (header.startsWith("! ")) rule.unset.push(header.slice(2).trim().toLowerCase());
    else {
      const colon = header.indexOf(":");
      rule.set.push([header.slice(0, colon).trim().toLowerCase(), header.slice(colon + 1).trim()]);
    }
  }
  return read;
}

/** A path pattern with at most one splat, matched whole. */
function matches(pattern: string, path: string): boolean {
  const star = pattern.indexOf("*");
  if (star === -1) return pattern === path;
  return path.startsWith(pattern.slice(0, star)) && path.endsWith(pattern.slice(star + 1)) && path.length >= pattern.length - 1;
}

/**
 * The headers a path is served with, applied as the platform documents it (developers.cloudflare.com/workers/static-assets/headers/):
 * every matching rule in order; a detach drops the value so far; a header set twice is joined with a comma.
 */
function served(all: Rule[], path: string): Map<string, string> {
  const headers = new Map<string, string>();
  const set = new Set<string>();
  for (const rule of all.filter((each) => matches(each.pattern, path))) {
    for (const name of rule.unset) headers.delete(name);
    for (const [name, value] of rule.set) {
      const held = headers.get(name);
      headers.set(name, set.has(name) && held !== undefined ? `${held}, ${value}` : value);
      set.add(name);
    }
  }
  return headers;
}

const YEAR = "public, max-age=31536000, immutable";

describe("the shell is never stale (R-SERVER-038)", () => {
  const headers = rules(readFileSync(join(PUBLIC, "_headers"), "utf8"));
  const cacheOf = (path: string) => served(headers, path).get("cache-control");

  test("[R-SERVER-038] given the page at / and /index.html and any path the page answers for, then each is served no-cache, always asked about again", () => {
    for (const path of ["/", "/index.html", "/invite/4f1e2d3c4b5a69788796a5b4", "/privacy", "/notify.sw.js", "/guides/sources/"]) expect({ path, cache: cacheOf(path) }).toEqual({ path, cache: "no-cache" });
  });

  test("[R-SERVER-038] given the build's hashed files under /assets/, then each is kept a year untouched; the models' manifest, the one name with no hash, is asked about every time", () => {
    for (const path of ["/assets/index-B3x9_aQz.js", "/assets/index-D1v2c3.css", "/assets/places/makoko/place.eef5138d7c1f.json", "/assets/shared/veh/veh_keke.0123456789ab.glb"]) expect({ path, cache: cacheOf(path) }).toEqual({ path, cache: YEAR });
    expect(cacheOf("/assets/manifest.json")).toBe("no-cache");
  });

  test("[R-SERVER-038] given the security headers on every path, then the cache rules leave them standing", () => {
    for (const path of ["/", "/assets/index-B3x9_aQz.js", "/assets/manifest.json"]) {
      const all = served(headers, path);
      expect(all.get("x-content-type-options")).toBe("nosniff");
      expect(all.get("content-security-policy-report-only")).toContain("default-src 'self'");
    }
  });

  test("[R-SERVER-038] the notice's service worker keeps no cache and answers no fetch, and says so", () => {
    const worker = readFileSync(join(PUBLIC, "notify.sw.js"), "utf8");
    const code = worker
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    expect(worker).toContain("no cache, no fetch handler");
    expect(code).not.toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(code).not.toMatch(/\bonfetch\b/);
    expect(code).not.toMatch(/\bcaches\b/);
    expect(code).not.toMatch(/addEventListener\(\s*["']install["']/);
  });

  test("[R-SERVER-038] a build carries its commit in index.html, and the page says it once in the console", () => {
    const plugin = buildStamp("2211239e4a1b");
    const hook = plugin.transformIndexHtml as () => { tag: string; attrs: Record<string, string>; injectTo: string }[];
    expect(hook()).toEqual([{ tag: "meta", attrs: { name: STAMP_META, content: "2211239e4a1b" }, injectTo: "head" }]);

    const page = new DOMParser().parseFromString(`<html><head><meta name="${STAMP_META}" content="2211239e4a1b"></head></html>`, "text/html");
    expect(buildOf(page)).toBe("2211239e4a1b");
    const lines: string[] = [];
    expect(sayBuild(page, (line) => lines.push(line))).toBe(true);
    expect(sayBuild(page, (line) => lines.push(line))).toBe(false);
    expect(lines).toEqual(["Japacity build 2211239e4a1b"]);
  });

  test("[R-SERVER-038] the build's commit is the checkout's, marked when the tree has changes", () => {
    const clean = (args: string[]) => (args[0] === "rev-parse" ? "2211239e4a1b\n" : "");
    const changed = (args: string[]) => (args[0] === "rev-parse" ? "2211239e4a1b\n" : " M apps/client/src/app/App.tsx\n");
    const before = process.env.JAPACITY_BUILD;
    delete process.env.JAPACITY_BUILD;
    try {
      expect(buildCommit(clean)).toBe("2211239e4a1b");
      expect(buildCommit(changed)).toBe("2211239e4a1b+changes");
    } finally {
      if (before !== undefined) process.env.JAPACITY_BUILD = before;
    }
  });
});

// A security.txt (RFC 9116) at the well-known path, a plain static file of the game.
describe("the security.txt", () => {
  const file = readFileSync(join(PUBLIC, ".well-known", "security.txt"), "utf8");
  const headers = rules(readFileSync(join(PUBLIC, "_headers"), "utf8"));

  test("given the file, when it is read, then it holds the four fields in order, the expiry in RFC 3339 form, and no signature or policy link", () => {
    const lines = file.split("\n");
    expect(lines.at(-1)).toBe("");
    const fields = lines.slice(0, -1).map((line) => {
      const colon = line.indexOf(": ");
      return [line.slice(0, colon), line.slice(colon + 2)];
    });
    expect(fields.map(([name]) => name)).toEqual(["Contact", "Expires", "Preferred-Languages", "Canonical"]);
    expect(Object.fromEntries(fields)).toMatchObject({ Contact: "mailto:security@japacity.app", "Preferred-Languages": "en", Canonical: "https://japacity.app/.well-known/security.txt" });
    const expires = fields[1]?.[1] ?? "";
    expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    expect(new Date(expires).toISOString()).toBe(expires.includes(".") ? expires : expires.replace("Z", ".000Z"));
    expect(file).not.toMatch(/BEGIN PGP|Policy:|Encryption:/);
  });

  test("[R-SERVER-038] given the file's path, then it is served no-cache like every unhashed file, never kept a year, with the security headers standing", () => {
    const all = served(headers, "/.well-known/security.txt");
    expect(all.get("cache-control")).toBe("no-cache");
    expect(all.get("x-content-type-options")).toBe("nosniff");
    // No rule names its type: the platform types a .txt file text/plain; charset=utf-8 from its extension.
    expect(headers.some((rule) => rule.pattern.includes(".well-known") || rule.set.some(([name]) => name === "content-type"))).toBe(false);
  });
});
