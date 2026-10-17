// japacity.app is the game's one address.
// The address the server trusts (SITE_URL, which the auth library, the passkeys' relying party,
// the Turnstile host check and the origin check all read) is the address the game is served
// from, on the same host as its API, and the Worker's Custom Domain.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { relyingPartyOf } from "./auth/auth";
import { tickPeriodMs, TICKS_CRON } from "./jobs/ticks";

const PRODUCTION = "https://japacity.app";
const STAGING = "https://staging.japacity.app";

interface Route {
  pattern: string;
  custom_domain?: boolean;
}

interface Worker {
  name: string;
  vars: Record<string, string>;
  routes?: Route[];
  assets?: { directory: string; not_found_handling?: string; binding?: string; run_worker_first?: string[] | boolean };
  workers_dev?: boolean;
  preview_urls?: boolean;
  observability?: Record<string, unknown>;
  triggers?: { crons: string[] };
  placement?: Record<string, string>;
  hyperdrive?: { binding: string; id: string }[];
  env?: Record<string, Worker>;
}

function wrangler(path: string): Worker {
  const text = readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as Worker;
}

/** R-SERVER-042: the observability every Worker deploys with. */
const OBSERVED = {
  enabled: true,
  logs: { enabled: true, head_sampling_rate: 1, invocation_logs: true },
  traces: { enabled: true, head_sampling_rate: 0.05 },
  issues: { enabled: true },
};

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

  test("given the staging environment, when its switches are read, then it has no workers.dev address and no preview URLs, written in its own block as at the top level", () => {
    expect(server.workers_dev).toBe(false);
    expect(server.preview_urls).toBe(false);
    expect(staging?.workers_dev).toBe(false);
    expect(staging?.preview_urls).toBe(false);
  });

  test("[R-SERVER-038] [R-CLOCK-012] given both environments, when their crons are read, then production ticks every five minutes with no TICK_CRON, staging on its own TICK_CRON of thirty minutes, both with the daily cron", () => {
    // Production's database is on a paid plan that need not sleep, so production sets no TICK_CRON and its first cron is TICKS_CRON.
    expect(server.vars["TICK_CRON"]).toBeUndefined();
    expect(server.triggers?.crons).toEqual([TICKS_CRON, "0 0 * * *"]);
    expect(staging?.vars["TICK_CRON"]).toBe("*/30 * * * *");
    expect(staging?.triggers?.crons).toEqual([staging?.vars["TICK_CRON"] ?? TICKS_CRON, "0 0 * * *"]);
  });

  test("[R-ADVERT-014] given both environments' tick crons, when the advert recheck reads their period, then staging's gives thirty minutes and production's five-minute cron gives five", () => {
    expect(tickPeriodMs(server.vars["TICK_CRON"] ?? TICKS_CRON)).toBe(5 * 60_000);
    expect(tickPeriodMs(staging?.vars["TICK_CRON"] ?? TICKS_CRON)).toBe(30 * 60_000);
    expect(tickPeriodMs(TICKS_CRON)).toBe(5 * 60_000);
  });

  test("[R-SERVER-038] given both environments, when their files and switches are read, then only staging runs the Worker first for every path with the files bound as ASSETS and NOINDEX set", () => {
    expect(server.vars["NOINDEX"]).toBeUndefined();
    expect(server.assets?.binding).toBeUndefined();
    expect(staging?.vars["NOINDEX"]).toBe("1");
    expect(staging?.assets).toEqual({ directory: "../client/dist", not_found_handling: "single-page-application", binding: "ASSETS", run_worker_first: true });
  });

  test("[R-SERVER-038] [R-SERVER-042] given both environments, when their observability is read, then production keeps every request's logs and invocation log, a twentieth of traces and Issues, and staging has no block of its own, so it inherits the same", () => {
    expect(server.observability).toEqual(OBSERVED);
    // `observability` is an inheritable key (wrangler's configuration page), so staging without one runs on the top level's.
    expect(staging?.observability).toBeUndefined();
    expect(staging?.observability ?? server.observability).toEqual(OBSERVED);
  });

  test("[R-SERVER-040] given both environments, when their placement is read, then each runs its fetch handler near Neon's London region, and both keep the cached Hyperdrive configuration bound", () => {
    expect(server.placement).toEqual({ region: "aws:eu-west-2" });
    expect(staging?.placement).toEqual({ region: "aws:eu-west-2" });
    expect(server.hyperdrive?.map((each) => each.binding)).toEqual(["GAME_DB", "CACHED_DB"]);
    expect(staging?.hyperdrive?.map((each) => each.binding)).toEqual(["GAME_DB", "CACHED_DB"]);
  });

  test("[R-ACCOUNT-003] given the shipped SITE_URLs, when the relying party is taken from each, then production's is the apex japacity.app and staging's is staging.japacity.app, never the same", () => {
    expect(relyingPartyOf(server.vars["SITE_URL"] ?? "")).toBe("japacity.app");
    expect(relyingPartyOf(staging?.vars["SITE_URL"] ?? "")).toBe("staging.japacity.app");
  });
});
