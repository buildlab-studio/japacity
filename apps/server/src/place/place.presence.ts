// R-CLOCK-025 to 028: the PresenceStore over the place objects. A join opens
// a real socket to the room the router picks, holding the member as its
// attachment, so the store and a player's socket meet the same object.
import type { PresenceStore } from "@japacity/store";

import { CLOSE_NORMAL } from "./place.socket";
import { leaveRooms, lookAround, openSocket } from "./place.rooms";
import type { Rooms } from "./place.rooms";

/** The client end of a socket the store opened, accepted so the object keeps it open. */
export function acceptedEnd(response: Response): WebSocket {
  const end = response.webSocket;
  if (response.status !== 101 || end === null) throw new Error(`The place refused the socket with ${String(response.status)}`);
  end.accept();
  return end;
}

export function placePresenceStore(rooms: Rooms): PresenceStore {
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
  };
}
