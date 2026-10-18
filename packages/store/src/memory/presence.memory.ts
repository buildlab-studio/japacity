import type { PresenceMember, PresenceStore } from "../types";
import { xorshift32 } from "../generator";
import { copy } from "./copy.memory";

/** clock:presence-held-in-memory, clock:attachments-rebuild-presence, clock:moving-switches-place-socket and clock:presence-is-a-sample: members by place, then by socket, in the order they joined. */
export function memoryPresenceStore(): PresenceStore {
  const places = new Map<string, Map<string, PresenceMember>>();

  return {
    join: (place, socket, member) => {
      const sockets = places.get(place) ?? new Map<string, PresenceMember>();
      sockets.set(socket, copy(member));
      places.set(place, sockets);
      return Promise.resolve();
    },
    leave: (place, socket) => {
      const sockets = places.get(place);
      sockets?.delete(socket);
      if (sockets?.size === 0) places.delete(place);
      return Promise.resolve();
    },
    sample: (place, n, asker, seed) => {
      // One entry per account, the first socket's, so a player on two tabs is shown once.
      const byAccount = new Map<string, PresenceMember>();
      for (const member of places.get(place)?.values() ?? []) {
        if (member.account !== asker && !byAccount.has(member.account)) byAccount.set(member.account, member);
      }
      const pool = [...byAccount.values()];
      const next = xorshift32(seed);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = next() % (i + 1);
        const held = pool[i];
        const swapped = pool[j];
        if (held === undefined || swapped === undefined) continue;
        pool[i] = swapped;
        pool[j] = held;
      }
      return Promise.resolve(copy(pool.slice(0, Math.max(0, n))));
    },
  };
}
