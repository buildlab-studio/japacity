// The fixed counter list of analytics.data.ts, as the server checks a row
// against it (analytics:server-checks-every-batch).
import type { Content, CounterDef } from "@japacity/sim";

/** analytics:server-checks-every-batch: why a row or a batch was dropped, the keys of `analytics/dropped`. */
export type DropReason = "signed-out" | "size" | "shape" | "rate" | "name" | "key" | "count";

/** The unknown region, as the account's country is stored when Cloudflare gave none. */
export const NO_REGION = "XX";

/** An account's region: its country, or the unknown region once the account is gone or when it has none. */
export function regionOf(account: { country: string } | null): string {
  return account === null || account.country === "" ? NO_REGION : account.country;
}

/** A request's region: Cloudflare's two-letter country, or the unknown region for anything else. */
export function requestRegion(country: string | null): string {
  return country !== null && /^[A-Z]{2}$/.test(country) ? country : NO_REGION;
}

/** analytics:session-split-by-command-gaps: the region a whole-game figure is kept under, such as the day's online peak; no account's region is ever this. */
export const WHOLE_GAME = "all";

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

/** analytics:server-checks-every-batch: a key is on its name's list, a region code, or an entry id the content holds. */
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
