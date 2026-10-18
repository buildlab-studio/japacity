// The interface counters a client sends (analytics.md R-ANALYTICS-003).

/** R-ANALYTICS-003: one row of a batch. */
export interface CounterRow {
  name: string;
  key: string;
  count: number;
}

/** R-ANALYTICS-003: the body of `POST /api/counters`. */
export interface CounterBatch {
  rows: CounterRow[];
}
