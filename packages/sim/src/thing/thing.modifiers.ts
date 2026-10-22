// What the things owned do to the acts the simulation already has: the fan's nap gives more, the gas
// cooker's pot takes less of the weekend, the data plan makes a course online cheaper. One function gives an act as the
// things that work now leave it, so the act now, a month's commitment and the view all read the same figures.
import { bp } from "../engine/int";
import type { ActivityEntry, Effect, ReadCtx } from "../engine/types";
import { working } from "./thing.logic";

/** An act as the things that work now leave it: its time never longer, its naira price cut, their lifts added to its effects. The same entry when no thing touches it. */
export function withThings(read: Pick<ReadCtx, "state" | "content">, entry: ActivityEntry): ActivityEntry {
  if (read.state.things.owned.length === 0) return entry;
  const mods = working(read).flatMap((thing) => thing.acts.filter((mod) => mod.activity === entry.id));
  if (mods.length === 0) return entry;
  const before = entry.halfDays;
  const halfDays = mods.reduce<number | undefined>((least, mod) => (mod.halfDays === undefined ? least : least === undefined ? mod.halfDays : Math.min(least, mod.halfDays)), before);
  const costBps = mods.flatMap((mod) => (mod.costBp === undefined ? [] : [mod.costBp]));
  const cost = costBps.length === 0 ? entry.cost : entry.cost.map((price) => (price.currency === "NGN" && typeof price.amount === "number" ? { ...price, amount: costBps.reduce((amount, cut) => bp(amount, cut), price.amount) } : price));
  const adds = mods.flatMap((mod) => (mod.adds ?? []).filter((add) => add.amount !== 0).map((add): Effect => ({ type: "quality/add", quality: add.quality, amount: add.amount })));
  return {
    ...entry,
    ...(halfDays === undefined ? {} : { halfDays }),
    cost,
    effects: [...entry.effects, ...adds],
  };
}
