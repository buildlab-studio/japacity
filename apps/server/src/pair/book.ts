// The pair records one transaction holds (pair.md R-PAIR-001, R-PAIR-004):
// read under the locks, changed only through `writeEvent`, and handed to the
// store once at the end with the version each was read at.
import type { PairRecord, PairWrite, Side } from "@japacity/sim";
import { writeEvent } from "@japacity/sim";

import type { Turn } from "../authority/transaction";

export interface Book {
  /** The record as it stands in this transaction, or null when there is none between the held characters. */
  get: (key: string) => PairRecord | null;
  /** A record made in this transaction, or one replaced whole. */
  put: (record: PairRecord) => void;
  /** R-PAIR-004: one write from one side. */
  write: (key: string, from: Side, write: PairWrite) => PairRecord;
  /** The keys of the records held, in key order. */
  keys: () => string[];
  /** Hands every changed record to the transaction. Called once, as the step ends. */
  flush: () => void;
}

export function bookOf(turn: Turn): Book {
  const stored = new Map(turn.pairs.map((row) => [row.key, row.v]));
  const records = new Map(turn.pairs.map((row) => [row.key, row.record as PairRecord]));
  const changed = new Set<string>();

  const get = (key: string) => records.get(key) ?? null;
  return {
    get,
    put: (record) => {
      records.set(record.id, record);
      changed.add(record.id);
    },
    write: (key, from, write) => {
      const record = get(key);
      if (record === null) throw new Error(`No pair record ${key} is held.`);
      const next = writeEvent(record, from, write);
      if (next !== record) {
        records.set(key, next);
        changed.add(key);
      }
      return next;
    },
    keys: () => [...records.keys()].sort(),
    flush: () => {
      for (const key of changed) {
        const record = records.get(key);
        if (record !== undefined) turn.writePair({ key, expectedV: stored.get(key) ?? 0, record });
      }
      changed.clear();
    },
  };
}
