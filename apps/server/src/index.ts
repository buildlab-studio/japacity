// The Worker. Builds the app once per isolate from the bindings; the
// scheduled handler runs the jobs by their cron (R-CLOCK-012, R-SERVER-011).
import { content } from "@japacity/content";

import { makeApp } from "./app";
import { contentsFor } from "./authority/overlay";
import { productionConfig } from "./config";
import { memoryStores, testSession, webRandomBytes } from "./deps";
import type { ServerDeps } from "./deps";
import { ticksJob } from "./jobs/ticks";
import type { Place } from "./place/place.object";
import { roomsFor } from "./place/place.rooms";
import { placeSocketRoutes } from "./routes/place";

export { Place } from "./place/place.object";

export interface Env {
  SITE_URL: string;
  WORLD_SEED?: string;
  OVERLAY?: string;
  COMMANDS_10S: RateLimit;
  COMMANDS_60S: RateLimit;
  READS_60S: RateLimit;
  ANON_60S: RateLimit;
  SOCKET_10S: RateLimit;
  GAME_DB: Hyperdrive;
  CACHED_DB: Hyperdrive;
  /** R-CLOCK-025: the place objects. */
  PLACE: DurableObjectNamespace<Place>;
}

let deps: ServerDeps | null = null;

/** The deployment's dependencies, made once per isolate (R-SERVER-016). The stores move to packages/db when it lands. */
function depsFor(env: Env): ServerDeps {
  deps ??= {
    config: productionConfig,
    stores: memoryStores(),
    contents: contentsFor(content, env.OVERLAY),
    secrets: { worldSeed: env.WORLD_SEED ?? "" },
    limits: { commands10s: env.COMMANDS_10S, commands60s: env.COMMANDS_60S, reads60s: env.READS_60S, anon60s: env.ANON_60S, socket10s: env.SOCKET_10S },
    // Replaced by the auth module's session reader when it lands; until then no request is signed in.
    session: testSession(productionConfig),
    now: () => Date.now(),
    randomBytes: webRandomBytes,
  };
  return deps;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    const built = depsFor(env);
    // The character's place, name and look come from the core's reads when it lands; until then no socket opens.
    return makeApp(built).route("/", placeSocketRoutes(built, { rooms: roomsFor(env.PLACE, built.config.presence), placeOf: () => Promise.resolve(null), profileOf: () => Promise.resolve(null) })).fetch(request);
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    // The jobs mount here as they land, by cron: the world's ticks (R-CLOCK-012) and the money report (R-SERVER-011).
    ctx.waitUntil(ticksJob(depsFor(env), controller.cron));
  },
};
