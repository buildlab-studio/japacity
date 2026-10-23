// clock:presence-held-in-memory, clock:attachments-rebuild-presence, clock:moving-switches-place-socket and clock:presence-is-a-sample: the PresenceStore over the place objects. A join opens
// a real socket to the room the router picks, holding the member as its
// attachment, so the store and a player's socket meet the same object.
import type { PresenceMember, PresenceStore } from "@japacity/store";

import { CLOSE_NORMAL } from "./place.socket";
import { forgetRooms, leaveRooms, lookAround, openSocket, roomLook } from "./place.rooms";
import type { Rooms } from "./place.rooms";
import type { Seen } from "./place.today";

/** clock:presence-is-a-sample, city:players-shown-present-not-tracked: who is here now, and some who were here today and are not now. */
interface PlaceLook {
  others: PresenceMember[];
  today: Seen[];
}

// PresenceStore in packages/store has no read of the day's list, so this interface is that read.
/** city:players-shown-present-not-tracked: the read of the day's list beside the sample. `now` names the Lagos day; `askerName` is never in the list read. */
export interface TodayReader {
  lookWithToday: (place: string, n: number, asker: string | null, seed: number, now: number, askerName: string | null) => Promise<PlaceLook>;
}

/** Whether a presence store also reads the day's list. */
export function readsToday(store: PresenceStore): store is PresenceStore & TodayReader {
  return typeof (store as Partial<TodayReader>).lookWithToday === "function";
}

/** The client end of a socket the store opened, accepted so the object keeps it open. */
export function acceptedEnd(response: Response): WebSocket {
  const end = response.webSocket;
  if (response.status !== 101 || end === null) throw new Error(`The place refused the socket with ${String(response.status)}`);
  end.accept();
  return end;
}

export function placePresenceStore(rooms: Rooms): PresenceStore & TodayReader {
  const ends = new Map<string, WebSocket>();

  return {
    join: async (place, socket, member) => {
      ends.set(socket, acceptedEnd(await openSocket(rooms, place, { kind: "member", socket, member })));
    },
    leave: async (place, socket) => {
      await leaveRooms(rooms, place, socket);
      ends.get(socket)?.close(CLOSE_NORMAL, "left");
      ends.delete(socket);
    },
    sample: (place, n, asker, seed) => lookAround(rooms, place, asker, n, seed),
    forget: async (places, account, name) => {
      await Promise.all(places.map((place) => forgetRooms(rooms, place, account, name)));
    },
    lookWithToday: async (place, n, asker, seed, now, askerName) => {
      const look = await roomLook(rooms, place, asker, n, seed, now, askerName);
      return { others: look.sample, today: look.today };
    },
  };
}
