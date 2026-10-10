// japacity.app is the game's one address.
// The address the server trusts (SITE_URL, which the auth library, the passkeys' relying party,
// the Turnstile host check and the origin check all read) is the address the game is served
// from, on the same host as its API, and the one the gate owns before launch.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { relyingPartyOf } from "./auth/auth";

const PRODUCTION = "https://japacity.app";
const STAGING = "https://staging.japacity.app";

interface Route {
  pattern: string;
  custom_domain?: boolean;
  zone_name?: string;
}

interface Worker {
  name: string;
  vars: Record<string, string>;
  routes?: Route[];
  assets?: { directory: string; not_found_handling?: string; run_worker_first?: string[] | boolean };
  env?: Record<string, Worker>;
}

function wrangler(path: string): Worker {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as Worker;
}

const server = wrangler("../wrangler.jsonc");
const staging = server.env?.["staging"];

describe("the game's address", () => {
  test("given the server's shipped settings, when they are read, then production is the game at japacity.app on its own custom domain, the API under /api on the same host", () => {
    expect(server.name).toBe("japacity-server");
    expect(server.vars["SITE_URL"]).toBe(PRODUCTION);
    expect(server.routes).toEqual([{ pattern: new URL(PRODUCTION).host, custom_domain: true }]);
    expect(server.assets).toEqual({ directory: "../client/dist", not_found_handling: "single-page-application", run_worker_first: ["/api/*"] });
  });

  test("given the server's staging environment, when it is read, then it is its own Worker at staging.japacity.app and nothing points at production", () => {
    expect(staging?.name).toBe("japacity-server-staging");
    expect(staging?.vars["SITE_URL"]).toBe(STAGING);
    expect(staging?.routes).toEqual([{ pattern: new URL(STAGING).host, custom_domain: true }]);
  });

  test("given the gate's shipped settings, when they are read, then before launch it owns the root of the game's host and its card picture is on that host", () => {
    const gate = wrangler("../../gate/wrangler.jsonc");
    expect(gate.routes).toEqual([{ pattern: `${new URL(PRODUCTION).host}/*`, zone_name: new URL(PRODUCTION).host }]);
    expect(gate.vars["SITE_URL"]).toBe(PRODUCTION);
  });

  test("[R-ACCOUNT-003] given the shipped SITE_URLs, when the relying party is taken from each, then production's is the apex japacity.app and staging's is staging.japacity.app, never the same", () => {
    expect(relyingPartyOf(server.vars["SITE_URL"] ?? "")).toBe("japacity.app");
    expect(relyingPartyOf(staging?.vars["SITE_URL"] ?? "")).toBe("staging.japacity.app");
  });
});
