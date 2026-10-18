import type { DedicationLight, DedicationStore } from "../dedication";
import { sharedOrder } from "../dedication";
import { refuse } from "../result";
import { accept, copy } from "./copy.memory";

/** server:dedication-routes: one light per account, kept in a map. */
export function memoryDedicationStore(): DedicationStore {
  const lights = new Map<string, DedicationLight>();
  return {
    light: (light) => {
      const kept: DedicationLight = { ...copy(light), approvedAt: null, approvedBy: null };
      lights.set(light.account, kept);
      return Promise.resolve(copy(kept));
    },
    putOut: (account) => Promise.resolve(lights.delete(account)),
    mine: (account) => {
      const found = lights.get(account);
      return Promise.resolve(found === undefined ? null : copy(found));
    },
    shared: (most) => {
      const all = [...lights.values()].sort(sharedOrder);
      return Promise.resolve({ count: all.length, lights: copy(all.slice(0, Math.max(0, most))) });
    },
    pending: () =>
      Promise.resolve(
        copy(
          [...lights.values()]
            .filter((light) => light.approvedAt === null)
            .sort((a, b) => a.litAt - b.litAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        ),
      ),
    approve: (account, by, at) => {
      const found = lights.get(account);
      if (found === undefined) return Promise.resolve(refuse("missing", `No light for ${account}.`));
      const approved: DedicationLight = { ...found, approvedAt: at, approvedBy: by };
      lights.set(account, approved);
      return Promise.resolve(accept(approved));
    },
  };
}
