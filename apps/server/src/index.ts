// The Worker. Builds the app once per isolate from the bindings; the
// scheduled handler runs the jobs by their cron (R-CLOCK-012, R-SERVER-011,
// R-ACCOUNT-017). The place object is exported here (R-CLOCK-025).
import { content } from "@japacity/content";

import { makeApp } from "./app";
import { makeAuth } from "./auth/auth";
import type { AuthKeys } from "./auth/auth";
import { memoryAuthAdapter } from "./auth/memory";
import { sessionReader } from "./auth/session";
import { contentsFor } from "./authority/overlay";
import { productionConfig } from "./config";
import { memoryStores, testSession, webRandomBytes } from "./deps";
import type { ServerDeps } from "./deps";
import { DRAND_URL, quicknet } from "./draw/beacon";
import type { DrawKeys } from "./draw/draw";
import { isolateDayLog } from "./analytics/daylog";
import { COUNTERS_CRON, countersJob } from "./jobs/counters";
import { runDeletions } from "./jobs/deletion";
import { drawJob } from "./jobs/draw";
import { ticksJob } from "./jobs/ticks";
import type { Place } from "./place/place.object";
import { roomsFor } from "./place/place.rooms";
import { drawRoute } from "./routes/draw";
import { placeSocketRoutes } from "./routes/place";

export { Place } from "./place/place.object";
import { MONEY_CRON, moneyJob } from "./jobs/money";
import { dropOldFeedback } from "./moderation/feedback";

export interface Env {
  SITE_URL: string;
  WORLD_SEED?: string;
  OVERLAY?: string;
  /** R-LOTTERY-008: the HMAC key of the draw's ticket tokens, a secret of the deployment. */
  DRAW_TOKEN_KEY?: string;
  /** R-LOTTERY-007: the drand relay the beacon is read from. */
  DRAND_URL?: string;
  COMMANDS_10S: RateLimit;
  COMMANDS_60S: RateLimit;
  READS_60S: RateLimit;
  ANON_60S: RateLimit;
  SOCKET_10S: RateLimit;
  GAME_DB: Hyperdrive;
  CACHED_DB: Hyperdrive;
  /** R-CLOCK-025: the place objects. */
  PLACE: DurableObjectNamespace<Place>;
  /** Secrets the maintainer sets with `wrangler secret put` (R-ACCOUNT-001, 013). */
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
}

let deps: ServerDeps | null = null;

/** The auth library's tables, held in the isolate until packages/db gives the Drizzle adapter. */
const authAdapter = memoryAuthAdapter();

/** Owner: the email provider (account.md R-ACCOUNT-014); until one is chosen no code leaves the server. */
function sendOtp(): Promise<void> {
  return Promise.reject(new Error("No email provider is configured."));
}

function authKeys(env: Env, waitUntil: (promise: Promise<unknown>) => void): AuthKeys {
  return {
    secret: env.BETTER_AUTH_SECRET,
    siteUrl: env.SITE_URL,
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    turnstile: { secretKey: env.TURNSTILE_SECRET_KEY },
    sendOtp,
    background: waitUntil,
  };
}

function drawKeys(env: Env): DrawKeys {
  return { tokenKey: env.DRAW_TOKEN_KEY ?? "", beacon: quicknet(fetch, env.DRAND_URL ?? DRAND_URL) };
}

/** The deployment's dependencies, made once per isolate (R-SERVER-016). The stores move to packages/db when it lands. */
function depsFor(env: Env): ServerDeps {
  deps ??= {
    config: productionConfig,
    stores: memoryStores(),
    contents: contentsFor(content, env.OVERLAY),
    secrets: { worldSeed: env.WORLD_SEED ?? "" },
    limits: { commands10s: env.COMMANDS_10S, commands60s: env.COMMANDS_60S, reads60s: env.READS_60S, anon60s: env.ANON_60S, socket10s: env.SOCKET_10S },
    // Replaced in each request by the auth library's session reader.
    session: testSession(productionConfig),
    now: () => Date.now(),
    randomBytes: webRandomBytes,
  };
  return deps;
}

/** The draw's keys from the bindings, until `ServerDeps` holds them. */
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const keys = authKeys(env, (promise) => ctx.waitUntil(promise));
    const auth = makeAuth(depsFor(env), authAdapter, keys);
    const built = { ...depsFor(env), session: sessionReader(auth) };
    // The character's place, name and look come from the core's reads when they are wired; until then no socket opens.
    return makeApp(built, { auth, keys })
      .route("/", drawRoute(built, drawKeys(env)))
      .route("/", placeSocketRoutes(built, { rooms: roomsFor(env.PLACE, built.config.presence), placeOf: () => Promise.resolve(null), profileOf: () => Promise.resolve(null) }))
      .fetch(request);
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    // By cron: the world's ticks (R-CLOCK-012) every five minutes; deletions (R-ACCOUNT-017) and the money report (R-SERVER-011) daily.
    ctx.waitUntil(ticksJob(depsFor(env), controller.cron));
    ctx.waitUntil(drawJob(depsFor(env), drawKeys(env), controller.cron));
    if (controller.cron === "0 0 * * *") ctx.waitUntil(runDeletions(depsFor(env), makeAuth(depsFor(env), authAdapter, authKeys(env, (promise) => ctx.waitUntil(promise)))));
    // R-ANALYTICS-008: before the money job, which forgets the day's active list once it has run.
    if (controller.cron === COUNTERS_CRON) ctx.waitUntil(countersJob(depsFor(env), isolateDayLog(depsFor(env))));
    if (controller.cron === MONEY_CRON) ctx.waitUntil(moneyJob(depsFor(env)));
    if (controller.cron === "0 0 * * *") ctx.waitUntil(dropOldFeedback(depsFor(env)));
  },
};
