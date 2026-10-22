// Cloudflare Web Analytics on the game's page (analytics:admin-stats-for-admins-only): the beacon only with a
// token from the build, and a page policy that lets in its script and its reports and no other outside host.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { BEACON_REPORTS, BEACON_SCRIPT, beaconPlugin, beaconTag, withBeacon } from "./analytics.plugin";

const CLIENT = join(import.meta.dirname, "..");
const PAGE = readFileSync(join(CLIENT, "index.html"), "utf8");
const HEADERS = readFileSync(join(CLIENT, "public", "_headers"), "utf8");

/** One directive of the page's policy, as its sources. */
function directive(name: string): string[] {
  const policy = /Content-Security-Policy[^:]*: (.*)/.exec(HEADERS)?.[1] ?? "";
  const found = policy.split(";").map((part) => part.trim().split(/\s+/)).find(([head]) => head === name);
  return found?.slice(1) ?? [];
}

describe("the analytics beacon on the game's page", () => {
  test("[analytics:admin-stats-for-admins-only] [analytics:store-holds-nothing-personal] given no token, an empty one, or one that is not a token, when the page is built, then it carries no script of the beacon", () => {
    for (const token of [undefined, "", "abc def", "abc\"><script>", "a".repeat(65)]) expect(withBeacon(PAGE, token)).toBe(PAGE);
    expect(PAGE).not.toContain("cloudflareinsights");
  });

  test("[analytics:admin-stats-for-admins-only] given a site token, when the page is built, then the beacon is the one script added, from Cloudflare, deferred, with the token and nothing about the player", () => {
    const built = withBeacon(PAGE, "0123abcdEF");
    expect(built.replace(beaconTag("0123abcdEF"), "").replace(/\s+/g, "")).toBe(PAGE.replace(/\s+/g, ""));
    expect(beaconTag("0123abcdEF")).toBe(`<script defer src="${BEACON_SCRIPT}/beacon.min.js" data-cf-beacon='{"token": "0123abcdEF", "spa": false}'></script>`);
    expect(built.indexOf("cloudflareinsights")).toBeLessThan(built.indexOf("</body>"));
  });

  test("[analytics:admin-stats-for-admins-only] given the build's environment with and without VITE_ANALYTICS_TOKEN, when the build's step runs, then the page gains the beacon only with it", () => {
    const built = (env: Record<string, unknown>) => {
      const plugin = beaconPlugin() as unknown as { configResolved: (config: { env: Record<string, unknown> }) => void; transformIndexHtml: (html: string) => string };
      plugin.configResolved({ env });
      return plugin.transformIndexHtml(PAGE);
    };
    expect(built({})).toBe(PAGE);
    expect(built({ VITE_ANALYTICS_TOKEN: "" })).toBe(PAGE);
    expect(built({ VITE_ANALYTICS_TOKEN: "0123abcdEF" })).toContain(beaconTag("0123abcdEF"));
  });

  test("[analytics:admin-stats-for-admins-only] given the page's policy, when it is read, then scripts come only from the page, the bot check and the beacon, and connections only to the page and the beacon's reports", () => {
    expect(directive("script-src")).toEqual(["'self'", "'wasm-unsafe-eval'", "https://challenges.cloudflare.com", BEACON_SCRIPT]);
    expect(directive("connect-src")).toEqual(["'self'", "blob:", BEACON_REPORTS]);
  });
});
