// The interface counters (analytics.md R-ANALYTICS-002, 003, 006, 011). Held
// in memory only and sent as batches of `{ name, key, count }`: nothing is
// written to the device, and only names and keys on the fixed list are ever
// counted, so no typed text can reach a batch.
import type { CounterRow } from "@japacity/api";
import { content } from "@japacity/content";
import type { CounterDef, Tuning } from "@japacity/sim";

export type AskKind = "sign-in" | "notify";
export type AskOutcome = "shown" | "accepted";

export interface Counters {
  /** Adds to a counter the list names for the client; anything else is ignored. */
  count: (name: string, key: string, by?: number) => void;
  /** R-ANALYTICS-011: an ask, keyed by whether the early win had been shown. */
  ask: (kind: AskKind, outcome: AskOutcome, afterEarlyWin: boolean) => void;
  /** R-ANALYTICS-006: off drops what is held and counts nothing more. */
  setEnabled: (on: boolean) => void;
  /** Sends what is held, as few batches as fit, and forgets it. */
  flush: () => void;
}

export interface CountersOptions {
  /** Sends one batch's body. The browser's beacon in the game, a stand-in in tests. */
  send: (body: string) => void;
  list?: readonly CounterDef[];
  tuning?: Tuning["analytics"];
  enabled?: boolean;
}

const ENTRY_ID = /^[a-z]+\.[a-z0-9-]+(?::[a-z0-9-]+)?$/;
const HEAD = '{"rows":[';
const TAIL = "]}";

const bytes = (text: string) => new TextEncoder().encode(text).length;

function allowed(def: CounterDef, key: string): boolean {
  if (Array.isArray(def.keys)) return def.keys.includes(key);
  return def.keys === "id" && ENTRY_ID.test(key);
}

/** Rows of at most `maxCount` each (R-ANALYTICS-004). */
function rowsOf(held: ReadonlyMap<string, CounterRow>, maxCount: number): CounterRow[] {
  const rows: CounterRow[] = [];
  for (const { name, key, count } of held.values()) {
    for (let left = count; left > 0; left -= maxCount) rows.push({ name, key, count: Math.min(left, maxCount) });
  }
  return rows;
}

/** R-ANALYTICS-003: the rows packed into bodies of at most `maxBytes` each, in order. */
export function packBatches(rows: readonly CounterRow[], maxBytes: number): string[] {
  const frame = bytes(HEAD) + bytes(TAIL);
  const bodies: string[] = [];
  let parts: string[] = [];
  let size = frame;
  for (const row of rows) {
    const part = JSON.stringify({ name: row.name, key: row.key, count: row.count });
    const partBytes = bytes(part);
    // A row too large for a batch of its own is never sent.
    if (frame + partBytes > maxBytes) continue;
    if (parts.length > 0 && size + 1 + partBytes > maxBytes) {
      bodies.push(`${HEAD}${parts.join(",")}${TAIL}`);
      parts = [];
      size = frame;
    }
    size += (parts.length > 0 ? 1 : 0) + partBytes;
    parts.push(part);
  }
  if (parts.length > 0) bodies.push(`${HEAD}${parts.join(",")}${TAIL}`);
  return bodies;
}

export function makeCounters({ send, list = content.analytics.counters, tuning = content.tuning.analytics, enabled = true }: CountersOptions): Counters {
  const held = new Map<string, CounterRow>();
  let on = enabled;

  function count(name: string, key: string, by = 1): void {
    if (!on || !Number.isInteger(by) || by < 1) return;
    const def = list.find((each) => each.name === name);
    if (def?.source !== "client" || !allowed(def, key)) return;
    const id = JSON.stringify([name, key]);
    held.set(id, { name, key, count: (held.get(id)?.count ?? 0) + by });
  }

  return {
    count,
    ask: (kind, outcome, afterEarlyWin) => count(`ask/${outcome}`, `${kind}:${afterEarlyWin ? "after" : "before"}`),
    setEnabled(value) {
      on = value;
      if (!on) held.clear();
    },
    flush() {
      if (!on || held.size === 0) return;
      const bodies = packBatches(rowsOf(held, tuning.maxCount), tuning.maxBatchBytes);
      held.clear();
      for (const body of bodies) send(body);
    },
  };
}

/** R-ANALYTICS-002: a load's time in bands, never in milliseconds. */
export function loadBand(ms: number): string {
  if (ms < 1000) return "under-1s";
  if (ms < 3000) return "1s-3s";
  if (ms < 10000) return "3s-10s";
  return "over-10s";
}
