// The deployment's dependencies on Postgres (decision 0004): a new `pg`
// client for each request through the Hyperdrive configuration with caching
// off, opened by the first statement a store or the auth library sends
// (R-SERVER-002), every store over it, the presence and
// the nudges on the place objects, and the client closed once the request is
// answered. Two stores live for the
// isolate instead, each opening a client per call: the switch row, whose cache
// is kept per store (R-SERVER-031), and the counters, whose hourly batch count
// is (R-ANALYTICS-004).
import type { Content, Id, PlaceEntry, Where, World } from "@japacity/sim";
import { connect, connectOnFirstUse, pgCounterStore, pgStores, pgSwitchStore } from "@japacity/db";
import type { Connection, Handle, Queries } from "@japacity/db";
import type { CounterStore, SwitchStore } from "@japacity/store";

import { load } from "./authority/load";
import type { Contents, Limiters, Secrets, ServerDeps, SessionReader, Stores } from "./deps";
import type { ServerConfig } from "./config";
import { placeNudgeBus } from "./nudge/place.nudge";
import type { PlaceOf } from "./nudge/place.nudge";
import type { Place } from "./place/place.object";
import { placePresenceStore } from "./place/place.presence";
import { roomsFor } from "./place/place.rooms";
import type { Rooms } from "./place/place.rooms";
import type { ProfileOf } from "./routes/place";
import { perCallHandle } from "./switches/connection";
import { dialedContents } from "./switches/dials";

/** What one isolate keeps between requests: never a database client. */
export interface Isolate {
  config: ServerConfig;
  contents: Contents;
  secrets: Secrets;
  limits: Limiters;
  /** The share-card first names and the like: the words a profile is shown with. */
  text: Record<string, string>;
  switches: SwitchStore;
  counters: CounterStore;
  rooms: Rooms;
  now: () => number;
  randomBytes: (count: number) => Uint8Array;
}

export interface IsolateBindings {
  /** The Hyperdrive configuration with caching off (decision 0004: game state is never read from a cache). */
  connectionString: string;
  place: DurableObjectNamespace<Place>;
}

export function isolateFor(bindings: IsolateBindings, base: Omit<Isolate, "switches" | "counters" | "rooms">, open: (url: string) => Promise<Pick<Connection, "handle" | "close">> = connect): Isolate {
  const perCall = perCallHandle(() => open(bindings.connectionString));
  return { ...base, switches: pgSwitchStore(perCall), counters: pgCounterStore(perCall), rooms: roomsFor(bindings.place, base.config.presence) };
}

/** One request's dependencies, the auth library's database on the same client, and the close the caller runs in a `finally`. */
export interface RequestScope {
  deps: ServerDeps;
  /** The client as the stores see it, for a store kept out of `pgStores` (the day log). */
  handle: Handle;
  db: Queries;
  close: () => Promise<void>;
  /** R-SERVER-043: true once the request's database refused the connection or dropped it. */
  unavailable: () => boolean;
}

/**
 * The character's state as its next load would see it, read without a lock
 * or a write, for the place and the profile. Null when the account has no
 * character, or the character cannot be read now.
 */
async function stateOfAccount(deps: ServerDeps, account: string) {
  const character = (await deps.stores.account.get(account))?.character ?? null;
  const held = character === null ? null : await deps.stores.player.load(character);
  if (held === null) return null;
  const worlds = new Map<number, World>();
  for (const row of held.tail) {
    const stored = worlds.has(row.tick) ? null : await deps.stores.world.tick(row.tick);
    if (stored !== null) worlds.set(row.tick, stored.world);
  }
  try {
    const loaded = load(held, await dialedContents(deps), worlds);
    return loaded.ok ? { state: loaded.live.state, content: loaded.live.content } : null;
  } catch {
    return null;
  }
}

/** Where a life opens when no content place is its hub: the client's own fallbacks (`features/city/staging.ts`). */
const NO_HUB: Record<Where, Id<"place">> = {
  home: "place.family-house",
  abroad: "place.the-room",
  road: "place.road-night",
};

/**
 * R-CITY-013, R-CITY-036: the hub a character's sockets and presence are for,
 * read as the client's `openingPlace` reads it so the socket route's place
 * check meets the client: the home hub at home, the country's hub abroad, the
 * stylised road place on the road.
 */
export function hubFor(where: Where, country: Id<"country"> | null, places: readonly PlaceEntry[]): Id<"place"> {
  const open = places.filter((place) => {
    switch (where) {
      case "home":
        return place.where === "home";
      case "abroad":
        return place.where === "abroad" && (place.country === null || place.country === country);
      case "road":
        return place.where === "road" && place.nameKind === "stylised";
      default: {
        const never: never = where;
        throw new Error(`Unknown where: ${String(never)}`);
      }
    }
  });
  const hub = open.find((place) => place.hub && (where !== "abroad" || place.country === country));
  return hub?.id ?? NO_HUB[where];
}

/** R-CLOCK-020, R-CLOCK-027, R-CITY-036: the content place a character's sockets and nudges are for. */
export function placeOfIn(deps: ServerDeps): PlaceOf {
  return async (account) => {
    const read = await stateOfAccount(deps, account);
    if (read === null) return null;
    const { where, country } = read.state.place;
    return hubFor(where, country, Object.values(read.content.place));
  };
}

/**
 * R-CITY-036: the name and look other players see.
 * the state holds neither; the scenario's share-card first name and
 * the scenario id stand in until the contract gives a display name and a look.
 */
export function profileOfIn(deps: ServerDeps, text: Record<string, string>): ProfileOf {
  return async (account) => {
    const read = await stateOfAccount(deps, account);
    if (read === null) return null;
    const scenario: Content["scenario"][keyof Content["scenario"]]["id"] = read.state.scenario;
    return { name: text[`share.first-name.${scenario}`] ?? "", look: scenario };
  };
}

/**
 * The request's dependencies over a new client, which connects on its first statement (R-SERVER-002);
 * `session` is filled by the caller once the auth library is made on `db`.
 */
export async function openRequest(isolate: Isolate, connectionString: string, open: (url: string) => Promise<Connection> = (url) => Promise.resolve(connectOnFirstUse(url))): Promise<RequestScope & { setSession: (reader: SessionReader) => void }> {
  const { handle, db, close, unavailable = () => false } = await open(connectionString);
  const stores = {} as Stores;
  let session: SessionReader = () => Promise.resolve(null);
  const deps: ServerDeps = {
    config: isolate.config,
    stores,
    contents: isolate.contents,
    secrets: isolate.secrets,
    limits: isolate.limits,
    session: (request) => session(request),
    now: isolate.now,
    randomBytes: isolate.randomBytes,
  };
  const placeOf = placeOfIn(deps);
  Object.assign(stores, {
    ...pgStores(handle),
    switches: isolate.switches,
    counters: isolate.counters,
    presence: placePresenceStore(isolate.rooms),
    nudges: placeNudgeBus(isolate.rooms, placeOf),
  } satisfies Stores);
  return {
    deps,
    handle,
    db,
    close,
    unavailable,
    setSession: (reader) => {
      session = reader;
    },
  };
}
