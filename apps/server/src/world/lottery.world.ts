// The Friday draw as each stored tick carries it (docs/rules/lottery.md).
import type { World } from "@japacity/sim";
import type { WorldStore } from "@japacity/store";

/** The draw open at a tick, for `World.lottery`. A stub: the draw agent replaces it with the open draw from the store. */
export const lotteryFor: (tick: number, world: WorldStore) => Promise<World["lottery"]> = () => Promise.resolve(null);
