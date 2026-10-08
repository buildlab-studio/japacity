// The Friday draw as each stored tick carries it (docs/rules/lottery.md
// R-LOTTERY-002, 006, 007, 015): the draw on sale, its close, fingerprint and
// beacon round, the pot so far, and the latest published result.
import type { LotteryResult, World } from "@japacity/sim";
import type { WorldStore } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { closesTickOf, drawOn } from "../draw/draw";

/**
 * R-LOTTERY-015: the newest result stored for a draw before `draw`. The row
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
 * R-LOTTERY-002, R-LOTTERY-006, R-LOTTERY-007: `World.lottery` for the row of
 * `tick`, from the stored draw on sale at it. The pot so far is the tickets
 * sold before the row is made, at the current content's price.
 * a tick whose draw is not stored yet runs no draw. The draw job opens each draw a whole draw ahead, so only a fresh deployment's first rows meet it.
 */
export async function lotteryFor(tick: number, deps: Pick<ServerDeps, "stores" | "contents">): Promise<World["lottery"]> {
  const world = deps.stores.world;
  const draw = drawOn(tick);
  const row = await world.draw(draw);
  if (row === null) return null;
  const sold = (await world.tickets(draw)).length;
  return {
    draw,
    closesTick: closesTickOf(draw),
    fingerprint: row.fingerprint,
    beaconRound: row.beaconRound,
    potSoFar: sold * deps.contents.current.tuning.lottery.ticket,
    last: await lastResult(world, tick, draw),
  };
}
