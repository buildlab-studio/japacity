// Selling (docs/rules/lottery.md R-LOTTERY-005): the tickets of each accepted
// `lottery/buy` are added to the draw's list inside the command's transaction,
// numbered in the order the purchases are committed.
import type { Rejection, World } from "@japacity/sim";
import type { WorldStore } from "@japacity/store";

import type { Live } from "../authority/load";

/**
 * R-LOTTERY-005, R-LOTTERY-008: adds the tickets of every `lottery/buy` the
 * transaction stepped, or a rejection when the list is already frozen, so a
 * purchase that misses the close writes nothing and costs nothing.
 */
export async function sellTickets(world: WorldStore, lives: readonly Live[], on: World): Promise<Rejection | null> {
  for (const live of lives) {
    for (const row of live.rows) {
      if (row.command.type !== "lottery/buy") continue;
      const open = on.lottery;
      if (open === null) throw new Error(`A lottery/buy for ${live.id} was accepted at tick ${String(on.tick)}, which runs no draw.`);
      const added = await world.addTickets(open.draw, live.id, row.command.tickets);
      if (!added.ok) return { ok: false, code: "not-legal", detail: `Draw ${String(open.draw)} has closed: ${added.detail}` };
    }
  }
  return null;
}
