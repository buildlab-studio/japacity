// The recorded lives the admin tests store, by name.
import type { FlatSave } from "@japacity/sim";
import { lifeSaves } from "@japacity/sim/testing";

export { createLife, playRows, storeWorlds } from "./memory";

export function life(name: string): FlatSave {
  const save = lifeSaves[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  return save;
}
