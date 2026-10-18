// The switch row as the server reads it (docs/rules/server.md R-SERVER-030,
// R-SERVER-031): from the store at most once every `switches.cacheMs` per
// isolate, so a change made anywhere is seen within that time, and at once by
// the isolate that made it.
import type { ServerRejection } from "@japacity/api";
import type { DialChange, SwitchName, SwitchRow, SwitchStore } from "@japacity/store";

import type { ServerDeps } from "../deps";

/** Keyed by the store, so each isolate's store keeps its own and a test's fresh stores start empty. */
const cache = new WeakMap<SwitchStore, { at: number; row: SwitchRow }>();

type Reads = Pick<ServerDeps, "config" | "stores" | "now">;

/** R-SERVER-031: the row, from the cache while it is younger than `switches.cacheMs`. */
export async function readSwitches(deps: Reads): Promise<SwitchRow> {
  const store = deps.stores.switches;
  const now = deps.now();
  const held = cache.get(store);
  // A clock that went back reads afresh rather than trust a row from the future.
  if (held !== undefined && now >= held.at && now - held.at < deps.config.switches.cacheMs) return held.row;
  const row = await store.read();
  cache.set(store, { at: now, row });
  return row;
}

export async function isOn(deps: Reads, name: SwitchName): Promise<boolean> {
  return (await readSwitches(deps)).switches[name];
}

/** R-SERVER-031: sets a switch, logs who and why, and refreshes this isolate's cache. */
export async function setSwitch(deps: Reads, name: SwitchName, on: boolean, admin: string, reason: string): Promise<SwitchRow> {
  const row = await deps.stores.switches.set(name, on, admin, reason, deps.now());
  cache.set(deps.stores.switches, { at: deps.now(), row });
  return row;
}

/** R-SERVER-030: sets or unsets a dial, logs who and why, and refreshes this isolate's cache. */
export async function setDial(deps: Reads, change: DialChange, admin: string, reason: string): Promise<SwitchRow | { detail: string }> {
  const written = await deps.stores.switches.setDial(change, admin, reason, deps.now());
  if (!written.ok) return { detail: written.detail };
  cache.set(deps.stores.switches, { at: deps.now(), row: written.value });
  return written.value;
}

/** R-SERVER-031: the whole seconds the full screen and any client wait before asking again. */
export function retryAfterSeconds(deps: Pick<ServerDeps, "config">): number {
  return Math.ceil(deps.config.switches.retryMs / 1000);
}

const WHAT: Record<SwitchName, string> = {
  signups: "Japacity is full right now. Try again shortly.",
  lottery: "Lottery sales are paused.",
  adverts: "No adverts are served right now.",
  partnerPlay: "Playing with other players is paused.",
  "boards.this-week.everyone": "This board is paused.",
  "boards.this-week.friends": "This board is paused.",
  "boards.all-time.everyone": "This board is paused.",
  "boards.all-time.friends": "This board is paused.",
  "boards.joined-week": "This board is paused.",
};

/** R-SERVER-031: the refusal for a request whose switch is off, answered 503. */
export function switchedOff(deps: Pick<ServerDeps, "config">, name: SwitchName): ServerRejection {
  return { ok: false, code: "switched-off", detail: WHAT[name], retryAfter: retryAfterSeconds(deps) };
}
