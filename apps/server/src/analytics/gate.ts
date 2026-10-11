// R-ANALYTICS-008: the counts the gate hands the game's Worker
// over its service binding (apps/gate): the holding screen served, the invite
// link used, and a page opened from a shared card. The binding is not on the
// internet, no cookie or header carries them, and the gate sends only a name,
// a key and the visitor's country as Cloudflare gave it. Each is one more on
// the day's total; nothing about the visitor is kept (R-ANALYTICS-007).
import type { CounterTotal } from "@japacity/store";

import { utcDay } from "../admin/day";
import type { ServerDeps } from "../deps";
import { dayName } from "./day";
import { counterDef, keyAllowed, NO_REGION } from "./list";

/** What the gate may count: two funnel steps and a card's arrival. */
const FROM_GATE: Readonly<Record<string, ((key: string) => boolean) | undefined>> = {
  "funnel/step": (key) => key === "holding" || key === "invited",
  "share/arrival": () => true,
};

/** One request seen by the gate adds at most this many rows. */
const MOST_ROWS = 2;

/** The rows the gate may add, from what it sent; anything else is left out. */
export function gateRows(deps: Pick<ServerDeps, "contents" | "now">, rows: unknown, country: unknown): CounterTotal[] {
  if (!Array.isArray(rows)) return [];
  const region = typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : NO_REGION;
  const day = dayName(utcDay(deps.now()));
  const found: CounterTotal[] = [];
  for (const row of rows.slice(0, MOST_ROWS) as unknown[]) {
    if (typeof row !== "object" || row === null) continue;
    const { name, key } = row as { name?: unknown; key?: unknown };
    if (typeof name !== "string" || typeof key !== "string") continue;
    const def = counterDef(deps.contents.current, name);
    if (def === null || FROM_GATE[name]?.(key) !== true || !keyAllowed(deps.contents.current, def, key)) continue;
    found.push({ day, region, name, key, count: 1 });
  }
  return found;
}

/** Adds what the gate counted; answers how many rows were counted. */
export async function countFromGate(deps: Pick<ServerDeps, "contents" | "now" | "stores">, rows: unknown, country: unknown): Promise<number> {
  const counted = gateRows(deps, rows, country);
  if (counted.length > 0) await deps.stores.counters.add(counted);
  return counted.length;
}
