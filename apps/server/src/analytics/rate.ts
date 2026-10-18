// analytics:server-checks-every-batch: batches a session has sent this hour. The analytics store
// may not hold a session (analytics:store-holds-nothing-personal) and the limiters
// in deps count only fixed periods, so the count is kept in the isolate's
// memory by account and UTC hour, as the money job keeps its active list;
// like the rate limits it is per isolate and not exact (server:limits-are-approximate).
import type { CounterStore } from "@japacity/store";
import { int, time } from "@japacity/sim";

const byStore = new WeakMap<CounterStore, { hour: number; sent: Map<string, number> }>();

/** Notes one batch from the account and says whether it is within `perHour`. */
export function batchAllowed(counters: CounterStore, account: string, now: number, perHour: number): boolean {
  const hour = int.divFloor(now, time.HOUR_MS);
  let held = byStore.get(counters);
  if (held?.hour !== hour) {
    held = { hour, sent: new Map() };
    byStore.set(counters, held);
  }
  const sent = (held.sent.get(account) ?? 0) + 1;
  held.sent.set(account, sent);
  return sent <= perHour;
}
