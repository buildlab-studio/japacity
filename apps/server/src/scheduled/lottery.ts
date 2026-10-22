// The draw's scheduled job (lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously, lottery:seed-from-secret-and-beacon, lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:winners-paid-by-authority, lottery:money-report-checks-draws and lottery:result-published-in-tick-row): on
// the five-minute cron, close and pay the draw whose close has begun and whose
// result is not stored, then open the draw on sale with the jackpot it leaves.
// Safe to run twice or at once: every step keeps what the first run stored.
import { tickAt } from "../clock/view";
import type { ServerDeps } from "../dependencies";
import type { DrawKeys } from "../lottery/draw";
import { closeDraw, drawOn, openDraw, storedBefore } from "../lottery/draw";
import { TICKS_CRON } from "./ticks";

/** What one run did, for the logs and the tests. */
export interface DrawRun {
  opened: number[];
  drawn: number[];
  waiting: { draw: number; why: string }[];
}

/**
 * lottery:ticket-list-frozen-anonymously, lottery:seed-from-secret-and-beacon, lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:winners-paid-by-authority, lottery:money-report-checks-draws and lottery:result-published-in-tick-row: the newest stored draw before `current`, when its
 * result is not stored. Draws open only once the one before is drawn, so it is
 * the only draw that can be waiting.
 */
async function due(deps: ServerDeps, current: number): Promise<number | null> {
  const row = await storedBefore(deps.stores.world, current);
  return row === null || row.result !== null ? null : row.draw;
}

/**
 * lottery:ticket-list-frozen-anonymously, lottery:seed-from-secret-and-beacon, lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:winners-paid-by-authority, lottery:money-report-checks-draws and lottery:result-published-in-tick-row: the draw waiting to be drawn is closed and paid
 * first. lottery:fingerprint-commits-secret, lottery:jackpot-rolls-over: then the draw on sale is opened with
 * the jackpot that result leaves, so a draw opens as soon as the one before it
 * is drawn; while that one waits, nothing new opens.
 */
export async function drawJob(deps: ServerDeps, keys: DrawKeys, cron: string): Promise<DrawRun> {
  const run: DrawRun = { opened: [], drawn: [], waiting: [] };
  if (cron !== TICKS_CRON) return run;
  const current = drawOn(tickAt(deps.config.clock, deps.now()));
  const waiting = await due(deps, current);
  if (waiting !== null) {
    const closed = await closeDraw(deps, keys, waiting);
    if (closed.kind === "waiting") {
      run.waiting.push({ draw: waiting, why: closed.why });
      return run;
    }
    run.drawn.push(waiting);
  }
  if ((await openDraw(deps, keys.beacon, current)) !== null) run.opened.push(current);
  return run;
}
