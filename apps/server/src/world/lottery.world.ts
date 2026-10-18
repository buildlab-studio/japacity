// The Friday draw as each stored tick carries it (docs/rules/lottery.md
// lottery:draw-sells-between-ticks, lottery:view-shows-draw-state, lottery:fingerprint-commits-secret, lottery:jackpot-rolls-over, lottery:result-published-in-tick-row, lottery:odds-fixed-at-draw-open): the draw on sale, its close,
// fingerprint and beacon round, its odds and the jackpot standing, the sales
// so far, and the latest published result.
import type { LotteryResult, World } from "@japacity/sim";
import { jackpotHit } from "@japacity/sim";
import type { WorldStore } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { closesTickOf, drawOn, storedBefore } from "../lottery/draw";

/**
 * lottery:result-published-in-tick-row: the newest result stored for a draw before `draw`. The row
 * before carries the newest known at its making, so only the draws after it
 * are read.
 */
async function lastResult(world: WorldStore, tick: number, draw: number): Promise<LotteryResult | null> {
  const before = tick > 0 ? ((await world.tick(tick - 1))?.world.lottery?.last ?? null) : null;
  for (let earlier = draw - 1; earlier > (before?.draw ?? -1); earlier -= 1) {
    const result = (await world.draw(earlier))?.result ?? null;
    if (result !== null) return result;
  }
  return before;
}

/**
 * lottery:draw-sells-between-ticks, lottery:view-shows-draw-state, lottery:fingerprint-commits-secret, lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open:
 * `World.lottery` for the row of `tick`, from the stored draw on sale at it,
 * with the odds and the jackpot it opened with and whether that jackpot rolled
 * over from the last result. The sales so far are the tickets sold before the
 * row is made, at the current content's price.
 * A draw opens only once the draw before it is drawn (`openDraw`), a
 * few minutes after the Friday close, and the close's own tick row is made at
 * the close. That row, and any made before the draw opens, carries the draw
 * before, closed, so its tickets show as being drawn and a purchase is refused
 * as closed; sales of the new draw start with the next row, Saturday 07:00 in
 * Lagos, with the result and the new jackpot. lottery:draw-sells-between-ticks says sales start
 * with tick 14n, so the code and the page differ here.
 * With no draw stored at or before the tick's draw the world runs no draw.
 */
export async function lotteryFor(tick: number, deps: Pick<ServerDeps, "stores" | "contents">): Promise<World["lottery"]> {
  const world = deps.stores.world;
  const row = (await world.draw(drawOn(tick))) ?? (await storedBefore(world, drawOn(tick)));
  if (row === null) return null;
  const sold = (await world.tickets(row.draw)).length;
  const last = await lastResult(world, tick, row.draw);
  return {
    draw: row.draw,
    closesTick: closesTickOf(row.draw),
    onSale: tick < closesTickOf(row.draw),
    fingerprint: row.fingerprint,
    beaconRound: row.beaconRound,
    salesSoFar: sold * deps.contents.current.tuning.lottery.ticket,
    jackpot: row.jackpot,
    rolledOver: last !== null && !jackpotHit(last.winners),
    odds: row.odds,
    last,
  };
}
