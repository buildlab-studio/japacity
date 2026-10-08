// The draw's scheduled job (docs/rules/lottery.md R-LOTTERY-007 to 015): on
// the five-minute cron, open the draw on sale and the one after it, then close
// and pay every draw whose close has begun and whose result is not stored.
// Safe to run twice or at once: every step keeps what the first run stored.
import { tickAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import type { DrawKeys } from "../draw/draw";
import { closeDraw, drawOn, openDraw } from "../draw/draw";
import { TICKS_CRON } from "./ticks";

/** What one run did, for the logs and the tests. */
export interface DrawRun {
  opened: number[];
  drawn: number[];
  waiting: { draw: number; why: string }[];
}

/** The draws before `current` whose result is not stored, oldest first. Draws are opened in order, so the first stored result or missing draw ends the search. */
async function due(deps: ServerDeps, current: number): Promise<number[]> {
  const found: number[] = [];
  for (let draw = current - 1; draw >= 0; draw -= 1) {
    const row = await deps.stores.world.draw(draw);
    if (row === null || row.result !== null) break;
    found.unshift(draw);
  }
  return found;
}

/**
 * R-LOTTERY-007: the draw on sale and the next are opened, so a draw's
 * fingerprint is stored before the tick that opens its sales is made.
 * R-LOTTERY-008 to 015: due draws are closed in order, and a draw that
 * waits holds back the ones after it, because the kind takes a payment only
 * for a draw newer than the last one it paid.
 */
export async function drawJob(deps: ServerDeps, keys: DrawKeys, cron: string): Promise<DrawRun> {
  const run: DrawRun = { opened: [], drawn: [], waiting: [] };
  if (cron !== TICKS_CRON) return run;
  const current = drawOn(tickAt(deps.config.clock, deps.now()));
  for (const draw of [current, current + 1]) {
    await openDraw(deps, keys.beacon, draw);
    run.opened.push(draw);
  }
  for (const draw of await due(deps, current)) {
    const closed = await closeDraw(deps, keys, draw);
    if (closed.kind === "waiting") {
      run.waiting.push({ draw, why: closed.why });
      break;
    }
    run.drawn.push(draw);
  }
  return run;
}
