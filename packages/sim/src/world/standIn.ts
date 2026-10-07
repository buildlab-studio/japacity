// The stand-in world: engine.md section 7, rate.md and news.md.
// Stub: every tick looks like tick 0. The world work replaces the body.
import { bp } from "../engine/int";
import type { Content, ForeignCurrency, Id, World } from "../engine/types";

const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD"];

export function standInWorld(_worldSeed: string, tick: number, content: Content): World {
  const { start, premiumFloorBp } = content.tuning.rate;
  const rates = {} as World["rates"];
  for (const currency of FOREIGN) {
    const official = start[currency];
    rates[currency] = { official, street: official + bp(official, premiumFloorBp) };
  }
  const vars: Record<Id<"var">, number> = {};
  for (const entry of Object.values(content.var)) vars[entry.id] = entry.start;
  return { tick, rates, vars, news: [] };
}
