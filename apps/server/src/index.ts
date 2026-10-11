// The Worker (decision 0004). Every request has one `pg` client through the
// Hyperdrive configuration with caching off, opened when a store or the auth
// library first asks for it, and closed after the reply; nothing holds a
// client between requests (worker.ts). The scheduled handler runs the jobs by
// their cron the same way (R-CLOCK-012, R-SERVER-011, R-ACCOUNT-017). No
// failure escapes to the platform's error page (R-SERVER-043), and each is
// logged once (R-SERVER-042). The place object is exported here (R-CLOCK-025).
import { pgDayLog } from "@japacity/db";
import { WorkerEntrypoint } from "cloudflare:workers";

import { countFromGate } from "./analytics/gate";
import { productionConfig } from "./config";
import { quicknet } from "./draw/beacon";
import { advertLinksJob } from "./adverts/job";
import { boardsWeekJob } from "./boards/job";
import { COUNTERS_CRON, countersJob } from "./jobs/counters";
import { runDeletions } from "./jobs/deletion";
import { drawJob } from "./jobs/draw";
import { MONEY_CRON, moneyJob } from "./jobs/money";
import { notifyJob } from "./jobs/notify";
import { onlineJob } from "./jobs/online";
import { runJobs } from "./jobs/run";
import type { NamedJob } from "./jobs/run";
import { standInJob } from "./jobs/stand-in";
import { jobCron, ticksJob, TICKS_CRON } from "./jobs/ticks";
import { logFailure } from "./log";
import { dropOldFeedback } from "./moderation/feedback";
import type { Place } from "./place/place.object";
import { answered } from "./security/fail";
import { served } from "./security/noindex";
import { gameReply, pushKeys, within } from "./worker";

export { Place } from "./place/place.object";

export interface Env {
  SITE_URL: string;
  /** R-SERVER-016: secrets of the deployment, set once with `wrangler secret put`. */
  WORLD_SEED: string;
  /** R-MODERATION-018: the salt of the banned identities' hashes. */
  BAN_SALT: string;
  /** R-LOTTERY-008: the HMAC key of the draw's ticket tokens. */
  DRAW_TOKEN_KEY: string;
  OVERLAY?: string;
  COMMANDS_10S: RateLimit;
  COMMANDS_60S: RateLimit;
  READS_60S: RateLimit;
  ANON_60S: RateLimit;
  SOCKET_10S: RateLimit;
  /** Decision 0004: game state, the auth library and every store, caching off. */
  GAME_DB: Hyperdrive;
  /** The configuration with caching on, for reads that may be stale; nothing uses it yet. */
  CACHED_DB: Hyperdrive;
  /** R-CLOCK-025: the place objects. */
  PLACE: DurableObjectNamespace<Place>;
  /** Secrets the maintainer sets with `wrangler secret put` (R-ACCOUNT-001, 013). */
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  /** R-CLOCK-031: the VAPID pair, base64url, and the address the push services can reach the maintainer at. No notice is sent without all three. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  /** R-CLOCK-012, R-SERVER-038: the deployment's tick cron when it is not the five-minute one (staging's thirty minutes). */
  TICK_CRON?: string;
  /** R-SERVER-038: set on staging only; every reply carries the noindex tag and robots.txt disallows all. */
  NOINDEX?: string;
  /** R-SERVER-038: the client's files, bound on staging only, where the Worker runs first for every path. */
  ASSETS?: Fetcher;
  /** R-ACCOUNT-014, R-SERVER-038: `mailpit` on the local stack only; unset on every deployment, where no mail is sent. */
  MAIL_TRANSPORT?: string;
  /** Mailpit's address on this machine, for MAIL_TRANSPORT=mailpit. */
  MAILPIT_URL?: string;
  /** R-SERVER-012: the admin accounts, comma-separated account ids. A Worker secret, set once per environment with `wrangler secret put ADMIN_ACCOUNTS`. */
  ADMIN_ACCOUNTS?: string;
}

/**
 * R-ANALYTICS-008: the gate's counts (apps/gate): the holding
 * screen served, the invite link used, a page opened from a shared card. Only
 * a Worker bound to this entrypoint by a service binding can call it; it is
 * not on the internet, and no cookie or header is involved. The gate sends a
 * counter's name and key and the visitor's country, and nothing else. A
 * failure is logged here (R-SERVER-042) and handed back to the gate, which
 * carries on without it.
 */
export class GateCounters extends WorkerEntrypoint<Env> {
  async count(rows: unknown, country: unknown): Promise<number> {
    try {
      return await within(this.env, (promise) => this.ctx.waitUntil(promise), ({ deps }) => countFromGate(deps, rows, country));
    } catch (error) {
      logFailure({ what: "gate-count", error });
      throw error;
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const waitUntil = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    // R-SERVER-043: the game's failures are answered inside `served`, so staging's tag stays on them; the outer
    // catch takes what is left (the files on staging). R-SERVER-038: a page or a file never opens a database client.
    return answered(request, () => served(request, env, (toGame) => answered(toGame, () => gameReply(toGame, env, waitUntil))));
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    const later = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    const job = (name: string, run: Parameters<typeof within>[2]): NamedJob => ({ name, run: () => within(env, later, run) });
    // R-CLOCK-012, R-SERVER-038: the deployment's tick cron stands for the five-minute one, so every job below runs at its pace.
    const cron = jobCron(controller.cron, env.TICK_CRON ?? TICKS_CRON);
    const daily = cron === "0 0 * * *";
    const beacon = quicknet((input, init) => fetch(input, init), productionConfig.lottery.beacon.url);
    // By cron: the world's ticks (R-CLOCK-012), the draws and the bank-full notices (R-CLOCK-031) every five minutes (or at the deployment's tick cron); deletions (R-ACCOUNT-017) and the money report (R-SERVER-011) daily.
    const jobs: NamedJob[] = [
      job("ticks", ({ deps }) => ticksJob(deps, cron)),
      job("draw", ({ deps }) => drawJob(deps, { beacon }, cron)),
      job("notify", ({ deps }) => notifyJob(deps, pushKeys(env), cron)),
      job("advert-links", ({ deps }) => advertLinksJob(deps, cron, (input, init) => fetch(input, init))),
      // city.md R-CITY-039: the board figures' week turns on the five-minute cron.
      job("boards-week", ({ deps }) => boardsWeekJob(deps, cron)),
      ...(daily ? [job("deletions", ({ deps }, auth) => runDeletions(deps, auth))] : []),
      // R-ANALYTICS-013: online now, sampled for the day's peak on the five-minute cron.
      job("online", ({ deps, handle }) => onlineJob(deps, pgDayLog(handle), cron)),
      // R-ANALYTICS-008, R-SERVER-011: both read the day's characters from the command log.
      ...(cron === COUNTERS_CRON ? [job("counters", ({ deps, handle }) => countersJob(deps, pgDayLog(handle), pgDayLog(handle)))] : []),
      ...(cron === MONEY_CRON ? [job("money", ({ deps, handle }) => moneyJob(deps, pgDayLog(handle)))] : []),
      ...(daily ? [job("feedback", ({ deps }) => dropOldFeedback(deps)), job("stand-in", ({ deps }) => standInJob(deps))] : []),
    ];
    // R-SERVER-043: each job caught and logged by its name; one failure never hides another.
    void runJobs(jobs, later);
  },
};
