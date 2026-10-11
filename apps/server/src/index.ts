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
import { LIVES_CRON, livesJob } from "./jobs/lives";
import { MONEY_CRON, moneyJob } from "./jobs/money";
import { notifyJob } from "./jobs/notify";
import { onlineJob } from "./jobs/online";
import { runJobs } from "./jobs/run";
import type { NamedJob } from "./jobs/run";
import { standInJob } from "./jobs/stand-in";
import { jobCron, tickPeriodMs, ticksJob, TICKS_CRON } from "./jobs/ticks";
import { logFailure } from "./log";
import { dropOldFeedback } from "./moderation/feedback";
import { answered } from "./security/fail";
import { served } from "./security/noindex";
import { gameReply, pushKeys, within } from "./worker";

export { Place } from "./place/place.object";

/**
 * The Worker's bindings: what `wrangler types` generates from wrangler.jsonc for both environments
 * (worker-configuration.d.ts; a binding only staging has is optional), with the secrets and the local
 * stack's values merged in by src/env.d.ts.
 */
export type Env = Cloudflare.Env;

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
      job("advert-links", ({ deps }) => advertLinksJob(deps, cron, (input, init) => fetch(input, init), tickPeriodMs(env.TICK_CRON ?? TICKS_CRON))),
      // city.md R-CITY-039: the board figures' week turns on the five-minute cron.
      job("boards-week", ({ deps }) => boardsWeekJob(deps, cron)),
      ...(daily ? [job("deletions", ({ deps }, auth) => runDeletions(deps, auth))] : []),
      // R-ANALYTICS-013: online now, sampled for the day's peak on the five-minute cron.
      job("online", ({ deps, handle }) => onlineJob(deps, pgDayLog(handle), cron)),
      // R-ANALYTICS-008, R-SERVER-011: both read the day's characters from the command log.
      ...(cron === COUNTERS_CRON ? [job("counters", ({ deps, handle }) => countersJob(deps, pgDayLog(handle), pgDayLog(handle)))] : []),
      ...(cron === MONEY_CRON ? [job("money", ({ deps, handle }) => moneyJob(deps, pgDayLog(handle)))] : []),
      // account.md R-ACCOUNT-031: the lives being played, home and abroad, for the two lights.
      ...(cron === LIVES_CRON ? [job("lives", ({ deps }) => livesJob(deps))] : []),
      ...(daily ? [job("feedback", ({ deps }) => dropOldFeedback(deps)), job("stand-in", ({ deps }) => standInJob(deps))] : []),
    ];
    // R-SERVER-043: each job caught and logged by its name; one failure never hides another.
    void runJobs(jobs, later);
  },
} satisfies ExportedHandler<Env>;
