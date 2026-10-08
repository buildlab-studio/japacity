// Helpers for the Workers tests of the place object. Every test file shares
// one runtime and one storage (the plugin's socket workaround), so each test
// takes its own scope and never meets another test's rooms.
import { env } from "cloudflare:workers";
import type { PresenceMember } from "@japacity/store";

import { productionConfig } from "../config";
import type { ServerConfig } from "../config";
import { acceptedEnd } from "./place.presence";
import { openSocket, roomsFor } from "./place.rooms";
import type { Rooms } from "./place.rooms";

let scopes = 0;

/** Rooms no other test uses, with the production limits unless a test names its own. */
export function freshRooms(over: Partial<ServerConfig["presence"]> = {}): Rooms {
  scopes++;
  return roomsFor(env.PLACE, { ...productionConfig.presence, ...over }, `test-${String(scopes)}/`);
}

export function member(account: string, place = "place.market"): PresenceMember {
  return { account, name: `Name ${account}`, look: `look-${account}`, place, joinedAt: 1_000 };
}

/** A client's end of a socket, with every text it received and how it closed. */
export interface ClientEnd {
  end: WebSocket;
  texts: string[];
  closed: { code: number } | null;
}

export function listenTo(end: WebSocket): ClientEnd {
  const client: ClientEnd = { end, texts: [], closed: null };
  end.addEventListener("message", (event) => {
    client.texts.push(typeof event.data === "string" ? event.data : "(binary)");
  });
  end.addEventListener("close", (event) => {
    client.closed = { code: event.code };
  });
  return client;
}

/** Opens a member's socket the way the route does, and listens on the client's end. */
export async function openMember(rooms: Rooms, account: string, place = "place.market", socket = `socket-${account}`): Promise<ClientEnd> {
  return listenTo(acceptedEnd(await openSocket(rooms, place, { kind: "member", socket, member: member(account, place) })));
}

/** Waits until `check` holds, for events that cross a socket. Fails the test after two seconds. */
export async function until(check: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let waited = 0; waited < 2000; waited += 10) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** Lets texts already sent cross their sockets. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
