// R-ANALYTICS-003, R-ANALYTICS-004, R-ANALYTICS-007: a batch as it arrives.
// Only `name`, `key` and `count` of each row are read; every other field,
// in the rows or around them, is never looked at again.
import type { CounterRow } from "@japacity/api";
import { FUNNEL_STEPS } from "@japacity/content";
import type { Content } from "@japacity/sim";

import { counterDef, keyAllowed } from "./list";
import type { DropReason } from "./list";

export interface Checked {
  rows: CounterRow[];
  dropped: Partial<Record<DropReason, number>>;
}

const bytes = (text: string) => new TextEncoder().encode(text).length;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Why one row is dropped, or null when it is counted. */
function rowFault(content: Content, row: unknown): DropReason | null {
  const fields = record(row);
  if (fields === null || typeof fields.name !== "string" || typeof fields.key !== "string") return "shape";
  const def = counterDef(content, fields.name);
  // A name the server makes itself is never taken from a client.
  if (def?.source !== "client") return "name";
  if (!keyAllowed(content, def, fields.key)) return "key";
  const count = fields.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > content.tuning.analytics.maxCount) return "count";
  return null;
}

/**
 * R-ANALYTICS-004: the rows of a batch that may be counted, and how many were
 * dropped and why. A body over `maxBatchBytes` or not of the batch's shape is
 * dropped whole, as one.
 */
export function checkBatch(content: Content, body: string): Checked {
  if (bytes(body) > content.tuning.analytics.maxBatchBytes) return { rows: [], dropped: { size: 1 } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { rows: [], dropped: { shape: 1 } };
  }
  const rows = record(parsed)?.rows;
  if (!Array.isArray(rows)) return { rows: [], dropped: { shape: 1 } };
  const checked: Checked = { rows: [], dropped: {} };
  for (const row of rows as unknown[]) {
    const fault = rowFault(content, row);
    if (fault === null) {
      const { name, key, count } = row as CounterRow;
      checked.rows.push({ name, key, count });
    } else {
      checked.dropped[fault] = (checked.dropped[fault] ?? 0) + 1;
    }
  }
  return checked;
}

/** R-ANALYTICS-004: the front door's screens, the only rows a batch may carry signed out. */
const DOOR_KEYS: ReadonlySet<string> = new Set(FUNNEL_STEPS.filter((each) => each.from === "screen/opened").map((each) => each.step));

export function isDoorRow(row: CounterRow): boolean {
  return row.name === "screen/opened" && DOOR_KEYS.has(row.key);
}
