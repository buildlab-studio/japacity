// The build served by `vite preview` carries the headers production gives it (server:csp-reports-to-own-origin,
// server:csp-holds-every-page): the browser tests run under the shipped content policy only if this reads the
// platform's `_headers` file as the platform does.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { cleanHtmlPath, headersFor, parseHeaders } from "./headers.plugin";

const HEADERS = readFileSync(join(import.meta.dirname, "..", "public", "_headers"), "utf8");

describe("the platform's headers file, read for the preview", () => {
  test("[server:csp-holds-every-page] given the shipped file, when the page, a game path, a hashed file and the models' manifest are asked for, then each carries the policy and its own caching", () => {
    const rules = parseHeaders(HEADERS);
    const policyOf = (path: string) => [...headersFor(rules, path)].filter(([name]) => name.toLowerCase().startsWith("content-security-policy"));
    const policies = policyOf("/");
    expect(policies.length).toBeGreaterThan(0);
    for (const path of ["/", "/index.html", "/invite/abc", "/terms", "/guides/", "/assets/index-abc.js", "/assets/manifest.json"]) expect({ path, policies: policyOf(path) }).toEqual({ path, policies });
    const cache = (path: string) => headersFor(rules, path).get("Cache-Control");
    expect(cache("/")).toBe("no-cache");
    expect(cache("/invite/abc")).toBe("no-cache");
    expect(cache("/assets/index-abc.js")).toBe("public, max-age=31536000, immutable");
    expect(cache("/assets/manifest.json")).toBe("no-cache");
  });

  test("[server:csp-holds-every-page] given rules with a splat, a placeholder, a header set twice and a detach, when a path is read, then it gets what the platform would send", () => {
    const rules = parseHeaders(["# a comment", "/*", "  X-One: a", "  Cache-Control: no-cache", "/shop/:item", "  X-One: b", "/shop/*", "  ! Cache-Control", "  Cache-Control: max-age=60", ""].join("\n"));
    expect([...headersFor(rules, "/shop/bag")]).toEqual([
      ["X-One", "a, b"],
      ["Cache-Control", "max-age=60"],
    ]);
    expect([...headersFor(rules, "/shop/bag/strap")]).toEqual([
      ["X-One", "a"],
      ["Cache-Control", "max-age=60"],
    ]);
    expect([...headersFor(rules, "/home")]).toEqual([
      ["X-One", "a"],
      ["Cache-Control", "no-cache"],
    ]);
    expect(headersFor(rules, "/shop.html").get("Cache-Control")).toBe("no-cache");
  });

  test("[server:csp-holds-every-page] given a header line before any path or with no name, when the file is read, then it is refused", () => {
    expect(() => parseHeaders("  X-One: a\n")).toThrow();
    expect(() => parseHeaders("/*\n  no name here\n")).toThrow();
  });

  test("[server:csp-holds-every-page] given an address ending in .html, when the preview is asked for it, then it goes on to the clean address as the platform sends it, and any other is served as it is", () => {
    expect(cleanHtmlPath("/terms.html")).toBe("/terms");
    expect(cleanHtmlPath("/index.html")).toBe("/");
    expect(cleanHtmlPath("/guides/visa/index.html")).toBe("/guides/visa/");
    expect(cleanHtmlPath("/terms")).toBeNull();
    expect(cleanHtmlPath("/assets/index-abc.js")).toBeNull();
  });
});
