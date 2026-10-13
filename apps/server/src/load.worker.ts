// The load test's Worker (docs/rules/load.md R-LOAD-001): the same app as
// index.ts under the local Workers runtime, with the test server's config
// (the test sign-in and the fast clock), the memory stores with their writes
// counted, and the load routes. Run only by `tools/load/wrangler.jsonc`; the
// production Worker never imports it.
import { content } from "@japacity/content";

import { makeApp } from "./app";
import { contentsFor, withContentBefore } from "./authority/overlay";
import { testConfig } from "./config";
import { memoryStores, testSession, webRandomBytes } from "./deps";
import type { ServerDeps } from "./deps";
import { countingPlayerStore, emptyCounts, loadRoutes } from "./routes/load";

export interface LoadEnv {
  WORLD_SEED?: string;
  COMMANDS_10S: RateLimit;
  COMMANDS_60S: RateLimit;
  READS_60S: RateLimit;
  ANON_60S: RateLimit;
  SOCKET_10S: RateLimit;
}

const counts = emptyCounts();
let built: ReturnType<typeof makeApp> | null = null;

function appFor(env: LoadEnv): ReturnType<typeof makeApp> {
  if (built !== null) return built;
  const config = testConfig({ testing: { testLogin: true, fastClock: true } });
  const stores = memoryStores();
  const deps: ServerDeps = {
    config,
    stores: { ...stores, player: countingPlayerStore(stores.player, counts) },
    contents: withContentBefore(contentsFor(content, undefined), content),
    secrets: { worldSeed: env.WORLD_SEED ?? "load-world-seed", banSalt: "load-ban-salt", drawTokenKey: "load-draw-token-key" },
    limits: { commands10s: env.COMMANDS_10S, commands60s: env.COMMANDS_60S, reads60s: env.READS_60S, anon60s: env.ANON_60S, socket10s: env.SOCKET_10S },
    session: testSession(config),
    now: () => Date.now(),
    randomBytes: webRandomBytes,
  };
  built = makeApp(deps).route("/", loadRoutes(deps, counts));
  return built;
}

export default {
  fetch(request: Request, env: LoadEnv): Response | Promise<Response> {
    return appFor(env).fetch(request);
  },
};
