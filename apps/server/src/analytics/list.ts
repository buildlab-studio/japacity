// The fixed counter list of analytics.data.ts, as the server checks a row
// against it (R-ANALYTICS-004).
import type { Content, CounterDef } from "@japacity/sim";

/** R-ANALYTICS-004: why a row or a batch was dropped, the keys of `analytics/dropped`. */
export type DropReason = "signed-out" | "size" | "shape" | "rate" | "name" | "key" | "count";

/** The unknown region, as the account's country is stored when Cloudflare gave none. */
export const NO_REGION = "XX";

export function counterDef(content: Content, name: string): CounterDef | null {
  return content.analytics.counters.find((def) => def.name === name) ?? null;
}

/** An entry id names an entry of its kind's table: `kind.slug`, or `kind.slug:word` where the page pairs it with a state or a choice. */
function knownId(content: Content, key: string): boolean {
  const [id = ""] = key.split(":");
  const kind = id.split(".")[0] ?? "";
  const table = (content as unknown as Record<string, unknown>)[kind];
  if (typeof table !== "object" || table === null || !Object.hasOwn(table, id)) return false;
  const entry = (table as Record<string, unknown>)[id];
  return typeof entry === "object" && entry !== null && (entry as { id?: unknown }).id === id;
}

/** R-ANALYTICS-004: a key is on its name's list, a region code, or an entry id the content holds. */
export function keyAllowed(content: Content, def: CounterDef, key: string): boolean {
  if (Array.isArray(def.keys)) return def.keys.includes(key);
  switch (def.keys) {
    case "region":
      return /^[A-Z0-9]{2}$/.test(key);
    case "id":
      return knownId(content, key);
    default: {
      const never: never = def.keys;
      throw new Error(`Unknown key list ${String(never)}.`);
    }
  }
}
