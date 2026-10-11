// The Worker (decision 0004). Every request opens one `pg` client through the
// Hyperdrive configuration with caching off, builds the stores and the auth
// library over it, answers, and closes it; nothing holds a client between
// requests. The scheduled handler runs the jobs by their cron the same way
// (R-CLOCK-012, R-SERVER-011, R-ACCOUNT-017). The place object is exported here (R-CLOCK-025).
import { content, text } from "@japacity/content";
import { pgDayLog } from "@japacity/db";
import { WorkerEntrypoint } from "cloudflare:workers";

import { makeApp } from "./app";
import { makeAuth } from "./auth/auth";
import type { AuthKeys } from "./auth/auth";
import { drizzleAuthAdapter } from "./auth/drizzle";
import { sessionReader } from "./auth/session";
import { contentsFor } from "./authority/overlay";
import { deployedConfig, productionConfig } from "./config";
import { webRandomBytes } from "./deps";
import { quicknet } from "./draw/beacon";
import { countFromGate } from "./analytics/gate";
import { mailFor } from "./mail/mail";
import { COUNTERS_CRON, countersJob } from "./jobs/counters";
import { onlineJob } from "./jobs/online";
import { runDeletions } from "./jobs/deletion";
import { drawJob } from "./jobs/draw";
import { standInJob } from "./jobs/stand-in";
import { notifyJob } from "./jobs/notify";
import { jobCron, ticksJob, TICKS_CRON } from "./jobs/ticks";
import { MONEY_CRON, moneyJob } from "./jobs/money";
import { dropOldFeedback } from "./moderation/feedback";
import { advertLinksJob } from "./adverts/job";
import { boardsWeekJob } from "./boards/job";
import type { PushKeys } from "./notify/webpush";
import { isolateFor, openRequest, placeOfIn, profileOfIn } from "./production";
import type { Isolate, RequestScope } from "./production";
import { adminStatsRoutes } from "./routes/admin-stats";
import { drawRoute } from "./routes/draw";
import { notifyKeyRoute } from "./routes/notify";
import { placeSocketRoutes } from "./routes/place";
import { served } from "./security/noindex";

export { Place } from "./place/place.object";

/**
 * The Worker's bindings: what `wrangler types` generates from wrangler.jsonc for both environments
 * (worker-configuration.d.ts; a binding only staging has is optional), with the secrets and the local
 * stack's values merged in by src/env.d.ts.
 */
export type Env = Cloudflare.Env;

let isolate: Isolate | null = null;

/** R-SERVER-016: what the isolate keeps: the overlay applied once, the secrets, the limits, the switch and counter stores. */
function isolateOf(env: Env): Isolate {
  isolate ??= isolateFor(
    { connectionString: env.GAME_DB.connectionString, place: env.PLACE },
    {
      config: deployedConfig(env.ADMIN_ACCOUNTS),
      contents: contentsFor(content, env.OVERLAY),
      secrets: { worldSeed: env.WORLD_SEED, banSalt: env.BAN_SALT, drawTokenKey: env.DRAW_TOKEN_KEY },
      limits: { commands10s: env.COMMANDS_10S, commands60s: env.COMMANDS_60S, reads60s: env.READS_60S, anon60s: env.ANON_60S, socket10s: env.SOCKET_10S },
      text,
      now: () => Date.now(),
      randomBytes: webRandomBytes,
    },
  );
  return isolate;
}

/**
 * Owner: the email provider (account.md R-ACCOUNT-014); until one is chosen no code leaves the server.
 * R-ACCOUNT-003: the notices go by the same way as the codes. Only the local stack sends, to Mailpit.
 */
function authKeys(env: Env, waitUntil: (promise: Promise<unknown>) => void): AuthKeys {
  const { sendOtp, sendNotice } = mailFor(env, { text, codeSeconds: productionConfig.auth.otp.expiresIn }, (input, init) => fetch(input, init));
  return {
    secret: env.BETTER_AUTH_SECRET,
    siteUrl: env.SITE_URL,
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    turnstile: { secretKey: env.TURNSTILE_SECRET_KEY },
    sendOtp,
    sendNotice,
    background: waitUntil,
  };
}

/** R-CLOCK-031: the push keys from the bindings, or null while one is missing. */
function pushKeys(env: Env): PushKeys | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  if (publicKey === undefined || privateKey === undefined || subject === undefined) return null;
  return { publicKey, privateKey, subject, numbers: productionConfig.notify, fetch: (input, init) => fetch(input, init) };
}

/**
 * One request's or one job's scope: the client opened and the auth library on
 * it. The client is closed once `run` has settled and so has every task the
 * library handed to `waitUntil`, so the reply never waits on the close.
 */
async function within<T>(env: Env, waitUntil: (promise: Promise<unknown>) => void, run: (scope: RequestScope, auth: ReturnType<typeof makeAuth>, keys: AuthKeys) => Promise<T>): Promise<T> {
  const scope = await openRequest(isolateOf(env), env.GAME_DB.connectionString);
  const tasks: Promise<unknown>[] = [];
  const keep = (promise: Promise<unknown>) => {
    tasks.push(promise);
    waitUntil(promise);
  };
  try {
    const keys = authKeys(env, keep);
    const auth = makeAuth(scope.deps, drizzleAuthAdapter(scope.db), keys);
    scope.setSession(sessionReader(auth));
    return await run(scope, auth, keys);
  } finally {
    waitUntil(Promise.allSettled(tasks).then(() => scope.close()));
  }
}

/**
 * R-ANALYTICS-008: the gate's counts (apps/gate): the holding
 * screen served, the invite link used, a page opened from a shared card. Only
 * a Worker bound to this entrypoint by a service binding can call it; it is
 * not on the internet, and no cookie or header is involved. The gate sends a
 * counter's name and key and the visitor's country, and nothing else.
 */
export class GateCounters extends WorkerEntrypoint<Env> {
  async count(rows: unknown, country: unknown): Promise<number> {
    return within(this.env, (promise) => this.ctx.waitUntil(promise), ({ deps }) => countFromGate(deps, rows, country));
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // R-SERVER-038: on staging a page or a file is served without opening a database client.
    return served(request, env, (toGame) =>
      within(env, (promise) => ctx.waitUntil(promise), async ({ deps, handle }, auth, keys) => {
        const app = makeApp(deps, { auth, keys })
          // R-ANALYTICS-012: the admin's numbers read the command log by its time.
          .route("/api/admin", adminStatsRoutes(deps, pgDayLog(handle)))
          .route("/", drawRoute(deps))
          .route("/", notifyKeyRoute(pushKeys(env)))
          .route("/", placeSocketRoutes(deps, { rooms: isolateOf(env).rooms, placeOf: placeOfIn(deps), profileOf: profileOfIn(deps, isolateOf(env).text) }));
        return app.fetch(toGame);
      }),
    );
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    const later = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    const job = (run: Parameters<typeof within>[2]) => later(within(env, later, run));
    // R-CLOCK-012, R-SERVER-038: the deployment's tick cron stands for the five-minute one, so every job below runs at its pace.
    const cron = jobCron(controller.cron, env.TICK_CRON ?? TICKS_CRON);
    const beacon = quicknet((input, init) => fetch(input, init), productionConfig.lottery.beacon.url);
    // By cron: the world's ticks (R-CLOCK-012), the draws and the bank-full notices (R-CLOCK-031) every five minutes (or at the deployment's tick cron); deletions (R-ACCOUNT-017) and the money report (R-SERVER-011) daily.
    job(({ deps }) => ticksJob(deps, cron));
    job(({ deps }) => drawJob(deps, { beacon }, cron));
    job(({ deps }) => notifyJob(deps, pushKeys(env), cron));
    job(({ deps }) => advertLinksJob(deps, cron, (input, init) => fetch(input, init)));
    // city.md R-CITY-039: the board figures' week turns on the five-minute cron.
    job(({ deps }) => boardsWeekJob(deps, cron));
    if (cron === "0 0 * * *") job(({ deps }, auth) => runDeletions(deps, auth));
    // R-ANALYTICS-013: online now, sampled for the day's peak on the five-minute cron.
    job(({ deps, handle }) => onlineJob(deps, pgDayLog(handle), cron));
    // R-ANALYTICS-008, R-SERVER-011: both read the day's characters from the command log.
    if (cron === COUNTERS_CRON) job(({ deps, handle }) => countersJob(deps, pgDayLog(handle), pgDayLog(handle)));
    if (cron === MONEY_CRON) job(({ deps, handle }) => moneyJob(deps, pgDayLog(handle)));
    if (cron === "0 0 * * *") job(({ deps }) => dropOldFeedback(deps));
    if (cron === "0 0 * * *") job(({ deps }) => standInJob(deps));
  },
} satisfies ExportedHandler<Env>;
