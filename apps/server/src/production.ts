// The deployment's dependencies on Postgres (decision 0006): a new `pg`
// client for each request through the Hyperdrive configuration with caching
// off, opened by the first statement a store or the auth library sends
// (server:one-command-one-transaction), every store over it, the presence and
// the nudges on the place objects, and the client closed once the request is
// answered. Two stores live for the
// isolate instead, each opening a client per call: the switch row, whose cache
// is kept per store (server:four-off-switches), and the counters, whose hourly batch count
// is (analytics:server-checks-every-batch).
import type { Id, PlaceEntry, Where, World } from "@japacity/sim";
import { boundedHandle, connect, connectOnFirstUse, pgCounterStore, pgStores, pgSwitchStore } from "@japacity/db";
import type { Connection, Handle, Queries } from "@japacity/db";
import type { CounterStore, SwitchStore } from "@japacity/store";

import { load } from "./authority/load";
import type { Contents, Limiters, Secrets, ServerDeps, SessionReader, Stores } from "./deps";
import type { ServerConfig } from "./config";
import { placeNudgeBus } from "./place/place.nudge";
import type { PlaceOf } from "./place/place.nudge";
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
  /** The Hyperdrive configuration with caching off (decision 0006: game state is never read from a cache). */
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
  /** server:no-platform-error-page: true once the request's database refused the connection or dropped it. */
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

/** Where a life opens when no content place is its hub: the client's own fallbacks (`shared/scene/staging.ts`). */
const NO_HUB: Record<Where, Id<"place">> = {
  home: "place.family-house",
  abroad: "place.the-room",
  road: "place.road-night",
};

/**
 * city:ojuelegba-is-the-hub, city:players-shown-present-not-tracked: the hub a character's sockets and presence are for,
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

/** clock:socket-only-nudges, clock:moving-switches-place-socket, city:players-shown-present-not-tracked: the content place a character's sockets and nudges are for. */
export function placeOfIn(deps: ServerDeps): PlaceOf {
  return async (account) => {
    const read = await stateOfAccount(deps, account);
    if (read === null) return null;
    const { where, country } = read.state.place;
    return hubFor(where, country, Object.values(read.content.place));
  };
}

/**
 * city:players-fill-the-crowd, city:players-shown-present-not-tracked, account:person-kept-with-character: the name and look other
 * players see: the account's username and the look kept with the character, never the character's own name. With no look kept
 * the look is empty, and the crowd draws a resident's in its place. Null for an account with no character.
 */
export function profileOfIn(deps: ServerDeps): ProfileOf {
  return async (account) => {
    const row = await deps.stores.account.get(account);
    if (row === null || row.character === null) return null;
    const person = await deps.stores.player.person(row.character);
    return { name: row.username, look: person?.look ?? "" };
  };
}

/** How a request's statements are bounded: `statementMs` for an admin read (server:ledger-alarm-lists-suspects). */
export interface RequestBounds {
  statementMs?: number;
}

/**
 * The request's dependencies over a new client, which connects on its first statement (server:one-command-one-transaction);
 * `session` is filled by the caller once the auth library is made on `db`. With `bounds.statementMs` every store
 * call runs in a transaction of its own under that statement timeout, the counters' reads included, which then go
 * through the request's client rather than the isolate's.
 */
export async function openRequest(
  isolate: Isolate,
  connectionString: string,
  open: (url: string) => Promise<Connection> = (url) => Promise.resolve(connectOnFirstUse(url)),
  bounds: RequestBounds = {},
): Promise<RequestScope & { setSession: (reader: SessionReader) => void }> {
  const opened = await open(connectionString);
  const { db, close, unavailable = () => false } = opened;
  const handle = bounds.statementMs === undefined ? opened.handle : boundedHandle(opened.handle, bounds.statementMs);
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
    counters: bounds.statementMs === undefined ? isolate.counters : pgCounterStore(handle),
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
