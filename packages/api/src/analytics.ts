// The interface counters a client sends (analytics:client-batches-counters).

/** analytics:client-batches-counters: one row of a batch. */
export interface CounterRow {
  name: string;
  key: string;
  count: number;
}

/** analytics:client-batches-counters: the body of `POST /api/counters`. */
export interface CounterBatch {
  rows: CounterRow[];
}
