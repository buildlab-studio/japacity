// The Worker (decision 0006). Every request has one `pg` client through the
// Hyperdrive configuration with caching off, opened when a store or the auth
// library first asks for it, and closed after the reply; nothing holds a
// client between requests (worker.ts). The scheduled handler runs the jobs by
// their cron the same way (clock:cron-stores-missing-ticks, server:daily-money-report, account:deleted-data-removed-within-month). No
// failure escapes to the platform's error page (server:no-platform-error-page), and each is
// logged once (server:shared-observability-block). The place object is exported here (clock:presence-held-in-memory).
import { pgDayLog } from "@japacity/db";

import { productionConfig } from "./config";
import { quicknet } from "./lottery/beacon";
import { advertLinksJob } from "./advert/scheduled";
import { boardsWeekJob } from "./boards/scheduled";
import { COUNTERS_CRON, countersJob } from "./scheduled/counters";
import { runDeletions } from "./scheduled/deletion";
import { drawJob } from "./scheduled/lottery";
import { LIVES_CRON, livesJob } from "./scheduled/lives";
import { MONEY_CRON, moneyJob } from "./scheduled/money";
import { notifyJob } from "./scheduled/notify";
import { onlineJob } from "./scheduled/online";
import { runJobs } from "./scheduled/run";
import type { NamedJob } from "./scheduled/run";
import { standInJob } from "./scheduled/standIn";
import { jobCron, tickPeriodMs, ticksJob, TICKS_CRON } from "./scheduled/ticks";
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

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const waitUntil = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    // server:no-platform-error-page: the game's failures are answered inside `served`, so staging's tag stays on them; the outer
    // catch takes what is left (the files on staging). server:production-and-staging: a page or a file never opens a database client.
    return answered(request, () => served(request, env, (toGame) => answered(toGame, () => gameReply(toGame, env, waitUntil))));
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    const later = (promise: Promise<unknown>) => ctx.waitUntil(promise);
    const job = (name: string, run: Parameters<typeof within>[2]): NamedJob => ({ name, run: () => within(env, later, run) });
    // clock:cron-stores-missing-ticks, server:production-and-staging: the deployment's tick cron stands for the five-minute one, so every job below runs at its pace.
    const cron = jobCron(controller.cron, env.TICK_CRON ?? TICKS_CRON);
    const daily = cron === "0 0 * * *";
    const beacon = quicknet((input, init) => fetch(input, init), productionConfig.lottery.beacon.url);
    // By cron: the world's ticks (clock:cron-stores-missing-ticks), the draws and the bank-full notices (clock:full-bank-push-notification) every five minutes (or at the deployment's tick cron); deletions (account:deleted-data-removed-within-month) and the money report (server:daily-money-report) daily.
    const jobs: NamedJob[] = [
      job("ticks", ({ deps }) => ticksJob(deps, cron)),
      job("draw", ({ deps }) => drawJob(deps, { beacon }, cron)),
      job("notify", ({ deps }) => notifyJob(deps, pushKeys(env), cron)),
      job("advert-links", ({ deps }) => advertLinksJob(deps, cron, (input, init) => fetch(input, init), tickPeriodMs(env.TICK_CRON ?? TICKS_CRON))),
      // city:boards-switch-when-and-who: the board figures' week turns on the five-minute cron.
      job("boards-week", ({ deps }) => boardsWeekJob(deps, cron)),
      ...(daily ? [job("deletions", ({ deps }, auth) => runDeletions(deps, auth))] : []),
      // analytics:session-split-by-command-gaps: online now, sampled for the day's peak on the five-minute cron.
      job("online", ({ deps, handle }) => onlineJob(deps, pgDayLog(handle), cron)),
      // analytics:nightly-game-counters, server:daily-money-report: both read the day's characters from the command log.
      ...(cron === COUNTERS_CRON ? [job("counters", ({ deps, handle }) => countersJob(deps, pgDayLog(handle), pgDayLog(handle)))] : []),
      ...(cron === MONEY_CRON ? [job("money", ({ deps, handle }) => moneyJob(deps, pgDayLog(handle)))] : []),
      // account:two-lights-and-wink-lines: the lives being played, home and abroad, for the two lights.
      ...(cron === LIVES_CRON ? [job("lives", ({ deps }) => livesJob(deps))] : []),
      ...(daily ? [job("feedback", ({ deps }) => dropOldFeedback(deps)), job("stand-in", ({ deps }) => standInJob(deps))] : []),
    ];
    // server:no-platform-error-page: each job caught and logged by its name; one failure never hides another.
    void runJobs(jobs, later);
  },
} satisfies ExportedHandler<Env>;
