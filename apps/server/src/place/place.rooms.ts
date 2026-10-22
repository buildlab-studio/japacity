// clock:busy-place-splits-rooms: a place is one or more numbered rooms, each its own object.
// Rooms are counted without a database: the router asks room 0, 1, 2 and on
// for its member count, which each object holds in memory, and stops at the
// first empty room. A newcomer only ever opens the first empty room, so a
// room past an empty one exists only when an earlier room emptied; its
// members keep their room until they leave.
import type { Nudge, PresenceMember } from "@japacity/store";

import type { ServerConfig } from "../config";
import type { Place } from "./place.object";
import { ATTACHMENT_HEADER, attachmentBytes, LIMITS_HEADER, STATUS_FULL, STATUS_TOO_LARGE } from "./place.socket";
import type { Attachment, RoomLook, SocketLimits } from "./place.socket";

/**
 * Where the objects live and the limits from the server's config.
 * `scope` keeps one test's rooms apart from another's; production uses "".
 */
export interface Rooms {
  namespace: DurableObjectNamespace<Place>;
  scope: string;
  limits: SocketLimits;
}

/** A full room refuses a newcomer when another got in first; the router asks again this many times. */
const OPEN_TRIES = 3;

/** The rooms of a deployment, with the limits from its config. */
export function roomsFor(namespace: DurableObjectNamespace<Place>, presence: ServerConfig["presence"], scope = ""): Rooms {
  return { namespace, scope, limits: { maxPerObject: presence.maxPerObject, attachmentBytes: presence.attachmentBytes, todayMax: presence.todayMax } };
}

export function roomName(scope: string, place: string, room: number): string {
  return `${scope}${place}#${String(room)}`;
}

export function roomStub(rooms: Rooms, place: string, room: number): DurableObjectStub<Place> {
  return rooms.namespace.get(rooms.namespace.idFromName(roomName(rooms.scope, place, room)));
}

/** clock:busy-place-splits-rooms: the fullest room with space, or the first empty room when every open room is full. */
export function pickRoom(counts: readonly number[], maxPerObject: number): number {
  let best = -1;
  let bestCount = -1;
  counts.forEach((count, room) => {
    if (count < maxPerObject && count > bestCount) {
      best = room;
      bestCount = count;
    }
  });
  return best === -1 ? counts.length : best;
}

/** The member counts of room 0 up to and including the first empty room. */
export async function roomCounts(rooms: Rooms, place: string): Promise<number[]> {
  const counts: number[] = [];
  for (let room = 0; ; room++) {
    const count = await roomStub(rooms, place, room).count();
    counts.push(count);
    if (count === 0) return counts;
  }
}

function upgrade(rooms: Rooms, attachment: Attachment): Request {
  return new Request("https://place/socket", {
    headers: { upgrade: "websocket", [ATTACHMENT_HEADER]: JSON.stringify(attachment), [LIMITS_HEADER]: JSON.stringify(rooms.limits) },
  });
}

/**
 * Opens a socket for the attachment: a member in the room the router picks,
 * a listener in room 0. Answers the object's response, a 101 with the
 * client's end of the socket when it was accepted.
 */
export async function openSocket(rooms: Rooms, place: string, attachment: Attachment): Promise<Response> {
  if (attachmentBytes(attachment) > rooms.limits.attachmentBytes) return new Response("attachment too large", { status: STATUS_TOO_LARGE });
  if (attachment.kind === "listener") return roomStub(rooms, place, 0).fetch(upgrade(rooms, attachment));
  let response = new Response("room full", { status: STATUS_FULL });
  for (let attempt = 0; attempt < OPEN_TRIES && response.status === STATUS_FULL; attempt++) {
    const room = pickRoom(await roomCounts(rooms, place), rooms.limits.maxPerObject);
    response = await roomStub(rooms, place, room).fetch(upgrade(rooms, attachment));
  }
  return response;
}

/**
 * clock:presence-is-a-sample, city:players-shown-present-not-tracked: the look of the room the asker is in, or of room 0
 * when the asker is in none. `now` names the Lagos day; null asks for no one seen today.
 */
export async function roomLook(rooms: Rooms, place: string, asker: string | null, n: number, seed: number, now: number | null): Promise<RoomLook> {
  let first: RoomLook | null = null;
  for (let room = 0; ; room++) {
    const look = await roomStub(rooms, place, room).look(place, asker, n, seed, now);
    first ??= look;
    if (look.holds) return look;
    if (look.members === 0) return first;
  }
}

/** clock:presence-is-a-sample: the sample from the room the asker is in, or from room 0 when the asker is in none. */
export async function lookAround(rooms: Rooms, place: string, asker: string | null, n: number, seed: number): Promise<PresenceMember[]> {
  return (await roomLook(rooms, place, asker, n, seed, null)).sample;
}

/** clock:socket-only-nudges: the nudge to every room of the place up to the first empty one, which may still hold listeners. */
export async function nudgeRooms(rooms: Rooms, place: string, account: string, nudge: Nudge): Promise<number> {
  let reached = 0;
  for (let room = 0; ; room++) {
    const sent = await roomStub(rooms, place, room).nudge(account, nudge);
    reached += sent.reached;
    if (sent.members === 0) return reached;
  }
}

/** account:player-deletes-account, moderation:fixed-admin-actions: the account's sockets closed and `name` off the day's list in every room of the place up to the first empty one. */
export async function forgetRooms(rooms: Rooms, place: string, account: string, name: string): Promise<void> {
  for (let room = 0; ; room++) {
    const left = await roomStub(rooms, place, room).forget(account, name);
    if (left.members === 0) return;
  }
}

/** clock:moving-switches-place-socket: closes one socket wherever it is in the place. */
export async function leaveRooms(rooms: Rooms, place: string, socket: string): Promise<void> {
  for (let room = 0; ; room++) {
    const left = await roomStub(rooms, place, room).leave(socket);
    if (left.found || left.members === 0) return;
  }
}
