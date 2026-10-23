/// <reference types="@cloudflare/vitest-plugin/types" />
import { PING, PONG } from "@japacity/api";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import type { Place } from "./place.object";
import { acceptedEnd, placePresenceStore } from "./place.presence";
import { lookAround, nextRoomName, openSocket, roomCounts, roomLook, roomStub } from "./place.rooms";
import type { Rooms } from "./place.rooms";
import { ATTACHMENT_HEADER, attachmentBytes, CLOSE_POLICY, CLOSE_REJOIN, LIMITS_HEADER, NUDGE_EVERY_MS, STATUS_FULL, STATUS_TOO_LARGE } from "./place.socket";
import type { Attachment } from "./place.socket";
import { freshRooms, listenTo, member, openMember, settle, until } from "./place.testing";
import type { ClientEnd } from "./place.testing";
import { lagosDay, TODAY_KEY } from "./place.today";
import type { Seen } from "./place.today";

const PLACE = "place.market";

function seenOf(account: string): Seen {
  const { name, look } = member(account);
  return { name, look };
}

function alarmOf(stub: DurableObjectStub<Place>): Promise<number | null> {
  return runInDurableObject(stub, (_instance: Place, state) => state.storage.getAlarm());
}

describe("the place object", () => {
  test("[clock:attachments-rebuild-presence] given three members on open sockets, when the object is evicted with its sockets hibernated, then the list comes back from the attachments", async () => {
    const rooms = freshRooms();
    const store = placePresenceStore(rooms);
    for (const account of ["account-1", "account-2", "account-3"]) await store.join(PLACE, `socket-${account}`, member(account));

    await evictDurableObject(roomStub(rooms, PLACE, 0));

    expect(await roomStub(rooms, PLACE, 0).count()).toBe(3);
    const shown = await store.sample(PLACE, 20, null, 0);
    expect(shown.map((each) => each.account).sort()).toEqual(["account-1", "account-2", "account-3"]);
    expect(shown.find((each) => each.account === "account-2")).toEqual(member("account-2"));
  });

  test("[clock:presence-held-in-memory] [city:players-shown-present-not-tracked] given members in a place, when the object's storage is read, then it holds only the day's list of names and looks", async () => {
    const rooms = freshRooms();
    await openMember(rooms, "account-1");
    await openMember(rooms, "account-2");

    const stored = await runInDurableObject(roomStub(rooms, PLACE, 0), (_instance: Place, state) => state.storage.list());

    expect([...stored.keys()]).toEqual([TODAY_KEY]);
    expect(stored.get(TODAY_KEY)).toEqual({ day: lagosDay(member("account-1").joinedAt), seen: [seenOf("account-1"), seenOf("account-2")] });
    for (const account of ["account-1", "account-2"]) expect(JSON.stringify(stored.get(TODAY_KEY))).not.toContain(JSON.stringify(account));
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(2);
  });

  test("[clock:attachments-rebuild-presence] given attachments at the limit and one byte over, when each socket is opened, then the first is accepted and the second refused", async () => {
    const rooms = freshRooms();
    const limit = productionConfig.presence.attachmentBytes;
    const shaped = (name: string): Attachment => ({ kind: "member", socket: "socket-edge", member: { ...member("account-edge"), name } });
    const name = "n".repeat(limit - attachmentBytes(shaped("")));

    expect(attachmentBytes(shaped(name))).toBe(limit);
    const over = await openSocket(rooms, PLACE, shaped(`${name}n`));
    const atLimit = await openSocket(rooms, PLACE, shaped(name));

    expect(over.status).toBe(STATUS_TOO_LARGE);
    expect(atLimit.status).toBe(101);
    atLimit.webSocket?.accept();
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(1);
  });

  test("[clock:attachments-rebuild-presence] given a request that bypasses the router with an attachment over the limit, when the object reads it, then it refuses the socket", async () => {
    const rooms = freshRooms();
    const big: Attachment = { kind: "member", socket: "socket-big", member: { ...member("account-big"), name: "n".repeat(productionConfig.presence.attachmentBytes) } };

    const response = await roomStub(rooms, PLACE, 0).fetch("https://place/socket", {
      headers: { upgrade: "websocket", [ATTACHMENT_HEADER]: JSON.stringify(big), [LIMITS_HEADER]: JSON.stringify(rooms.limits) },
    });

    expect(response.status).toBe(STATUS_TOO_LARGE);
    await response.text();
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(0);
  });

  test("[clock:moving-switches-place-socket] given two members, when one closes its socket from the client, then it leaves the list and the other stays", async () => {
    const rooms = freshRooms();
    const leaving = await openMember(rooms, "account-1");
    await openMember(rooms, "account-2");

    leaving.end.close(1000, "moved");
    await until(async () => (await roomStub(rooms, PLACE, 0).count()) === 1, "the close to reach the object");

    const shown = await lookAround(rooms, PLACE, null, 20, 0);
    expect(shown.map((each) => each.account)).toEqual(["account-2"]);
  });

  test("[clock:presence-is-a-sample] given members coming and going, when the window passes, then each member gets one presence nudge and the next change waits a full window", async () => {
    const rooms = freshRooms();
    const stub = roomStub(rooms, PLACE, 0);
    const before = Date.now();
    const first = await openMember(rooms, "account-1");
    const second = await openMember(rooms, "account-2");
    const set = await alarmOf(stub);
    const third = await openMember(rooms, "account-3");

    expect(set).not.toBeNull();
    expect((set ?? 0) - before).toBeGreaterThanOrEqual(NUDGE_EVERY_MS);
    expect(await alarmOf(stub)).toBe(set);

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await settle();
    for (const client of [first, second, third]) expect(client.texts).toEqual([JSON.stringify({ nudge: "presence" })]);

    const ranAt = Date.now();
    third.end.close(1000, "left");
    await until(async () => (await alarmOf(stub)) !== null, "the next window's alarm");
    expect(((await alarmOf(stub)) ?? 0) - ranAt).toBeGreaterThanOrEqual(NUDGE_EVERY_MS);
    expect(first.texts).toHaveLength(1);
  });

  test("[clock:presence-is-a-sample] given more members than the sample, when the place is looked at, then the sample is the configured size and never shows the asker", async () => {
    const rooms = freshRooms();
    const size = productionConfig.presence.sample;
    for (let index = 0; index <= size + 1; index++) await openMember(rooms, `account-${String(index)}`);

    const shown = await lookAround(rooms, PLACE, "account-0", size, 99);

    expect(shown).toHaveLength(size);
    expect(shown.map((each) => each.account)).not.toContain("account-0");
  });

  test("[clock:busy-place-splits-rooms] given rooms of three, when members join and one leaves, then each newcomer takes the fullest room with space and a full place opens the next room", async () => {
    const rooms = freshRooms({ maxPerObject: 3 });
    const store = placePresenceStore(rooms);
    for (let index = 1; index <= 7; index++) await store.join(PLACE, `socket-${String(index)}`, member(`account-${String(index)}`));

    expect(await roomCounts(rooms, PLACE)).toEqual([3, 3, 1, 0]);

    await store.leave(PLACE, "socket-5");
    expect(await roomCounts(rooms, PLACE)).toEqual([3, 2, 1, 0]);

    await store.join(PLACE, "socket-8", member("account-8"));
    expect(await roomCounts(rooms, PLACE)).toEqual([3, 3, 1, 0]);
  });

  test("[clock:busy-place-splits-rooms] given a room at its cap, when a member is sent to it directly, then the object refuses it", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    await openMember(rooms, "account-1");

    const response = await roomStub(rooms, PLACE, 0).fetch("https://place/socket", {
      headers: {
        upgrade: "websocket",
        [ATTACHMENT_HEADER]: JSON.stringify({ kind: "member", socket: "socket-2", member: member("account-2") }),
        [LIMITS_HEADER]: JSON.stringify(rooms.limits),
      },
    });

    expect(response.status).toBe(STATUS_FULL);
    await response.text();
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(1);
  });

  test("[clock:client-sends-only-pings] given a member's socket, when the client pings, then the automatic reply answers it", async () => {
    const rooms = freshRooms();
    const client = await openMember(rooms, "account-1");

    const pair = await runInDurableObject(roomStub(rooms, PLACE, 0), (_instance: Place, state) => state.getWebSocketAutoResponse());
    client.end.send(PING);
    await until(() => client.texts.includes(PONG), "the automatic reply");

    expect(pair?.request).toBe(PING);
    expect(pair?.response).toBe(PONG);
  });

  test("[server:noisy-socket-closed] given a socket, when it sends the limit of messages and then one more, then it stays open at the limit and is closed with 1008 past it", async () => {
    const rooms = freshRooms();
    const client = await openMember(rooms, "account-1");
    const limit = productionConfig.limits.socketPer10s;

    for (let sent = 0; sent < limit; sent++) client.end.send("hello");
    await settle();
    expect(client.closed).toBeNull();
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(1);

    client.end.send("hello");
    await until(() => client.closed !== null, "the socket to close");

    expect(client.closed).toEqual({ code: CLOSE_POLICY });
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(0);
  });
});

/** Midnight in Lagos on 8 Oct 2026, which is 23:00 UTC on 8 Oct. */
const MIDNIGHT = Date.UTC(2026, 9, 8, 23);

/** Opens a member's socket that joined at `joinedAt`, as the route stamps it. */
async function openAt(rooms: Rooms, account: string, joinedAt: number): Promise<ClientEnd> {
  return listenTo(acceptedEnd(await openSocket(rooms, PLACE, { kind: "member", socket: `socket-${account}`, member: { ...member(account), joinedAt } })));
}

/** Opens and then closes a member's socket, so they were here and are not now. */
async function visit(rooms: Rooms, account: string, joinedAt: number): Promise<void> {
  const client = await openAt(rooms, account, joinedAt);
  const before = await roomStub(rooms, PLACE, 0).count();
  client.end.close(1000, "moved");
  await until(async () => (await roomStub(rooms, PLACE, 0).count()) === before - 1, "the close to reach the object");
}

function storedList(rooms: Rooms): Promise<unknown> {
  return runInDurableObject(roomStub(rooms, PLACE, 0), (_instance: Place, state) => state.storage.get(TODAY_KEY));
}

describe("the day's seen list in the place object", () => {
  test("[city:players-shown-present-not-tracked] given todayMax members and then one more, when each joins, then the list holds todayMax and the first is dropped", async () => {
    const rooms = freshRooms();
    const max = productionConfig.presence.todayMax;
    for (let index = 0; index < max; index++) await openAt(rooms, `account-${String(index)}`, MIDNIGHT);

    const atMax = await storedList(rooms);
    await openAt(rooms, `account-${String(max)}`, MIDNIGHT);
    const over = await storedList(rooms);

    expect((atMax as { seen: Seen[] }).seen).toHaveLength(max);
    expect((atMax as { seen: Seen[] }).seen[0]).toEqual(seenOf("account-0"));
    expect((over as { seen: Seen[] }).seen).toHaveLength(max);
    expect((over as { seen: Seen[] }).seen[0]).toEqual(seenOf("account-1"));
    expect((over as { seen: Seen[] }).seen.at(-1)).toEqual(seenOf(`account-${String(max)}`));
  });

  test("[city:players-shown-present-not-tracked] given players who were here and left, when the object is evicted, then the list comes back from storage", async () => {
    const rooms = freshRooms();
    await visit(rooms, "account-1", MIDNIGHT);
    await visit(rooms, "account-2", MIDNIGHT);

    await evictDurableObject(roomStub(rooms, PLACE, 0));

    expect(await roomStub(rooms, PLACE, 0).count()).toBe(0);
    const look = await roomLook(rooms, PLACE, null, productionConfig.presence.sample, 3, MIDNIGHT);
    expect(look.today.map((each) => each.name).sort()).toEqual(["Name account-1", "Name account-2"]);
  });

  test("[city:players-shown-present-not-tracked] given players seen in the last minute before Lagos midnight, when the day turns, then they are gone and the next join starts a new list", async () => {
    const rooms = freshRooms();
    const sample = productionConfig.presence.sample;
    await visit(rooms, "account-1", MIDNIGHT - 1);

    const before = await roomLook(rooms, PLACE, null, sample, 3, MIDNIGHT - 1);
    const after = await roomLook(rooms, PLACE, null, sample, 3, MIDNIGHT);
    await visit(rooms, "account-2", MIDNIGHT);

    expect(before.today).toEqual([seenOf("account-1")]);
    expect(after.today).toEqual([]);
    expect(await storedList(rooms)).toEqual({ day: lagosDay(MIDNIGHT), seen: [seenOf("account-2")] });
  });

  test("[city:players-shown-present-not-tracked] given a past day's list, when the presence alarm runs, then the list is deleted", async () => {
    const rooms = freshRooms();
    await visit(rooms, "account-1", 1_000);

    expect(await runDurableObjectAlarm(roomStub(rooms, PLACE, 0))).toBe(true);

    expect(await storedList(rooms)).toBeUndefined();
  });

  test("[city:players-shown-present-not-tracked] [clock:presence-is-a-sample] given players here now and others seen today, when the asker looks, then today holds none here now, never the asker, and fills only what the sample leaves", async () => {
    const rooms = freshRooms();
    for (const account of ["account-1", "account-2", "account-3"]) await visit(rooms, account, MIDNIGHT);
    await openAt(rooms, "account-0", MIDNIGHT);
    await openAt(rooms, "account-9", MIDNIGHT);

    const wide = await roomLook(rooms, PLACE, "account-0", 20, 5, MIDNIGHT);
    const narrow = await roomLook(rooms, PLACE, "account-0", 2, 5, MIDNIGHT);

    expect(wide.sample.map((each) => each.account)).toEqual(["account-9"]);
    expect(wide.today.map((each) => each.name).sort()).toEqual(["Name account-1", "Name account-2", "Name account-3"]);
    expect(narrow.sample).toHaveLength(1);
    expect(narrow.today).toHaveLength(1);
    for (const each of wide.today) expect(Object.keys(each).sort()).toEqual(["look", "name"]);
  });

  test("[city:players-shown-present-not-tracked] [moderation:fixed-admin-actions] [account:player-deletes-account] given an account here on two sockets and others seen today, when the place forgets the account by its old name, then both its sockets close, it leaves the room, and the name leaves the day's list while the others stay", async () => {
    const rooms = freshRooms();
    const store = placePresenceStore(rooms);
    const first = await openMember(rooms, "account-1", PLACE, "socket-1a");
    const second = await openMember(rooms, "account-1", PLACE, "socket-1b");
    const other = await openMember(rooms, "account-2");
    const gone = await openMember(rooms, "account-3");
    gone.end.close(1000, "moved");
    await until(async () => (await roomStub(rooms, PLACE, 0).count()) === 3, "the close to reach the object");

    await store.forget([PLACE, "place.church"], "account-1", seenOf("account-1").name);
    await until(() => first.closed !== null && second.closed !== null, "both sockets to close");

    expect(await roomStub(rooms, PLACE, 0).count()).toBe(1);
    expect(other.closed).toBeNull();
    const look = await roomLook(rooms, PLACE, "account-9", 20, 0, member("account-1").joinedAt);
    expect(look.sample.map((each) => each.account)).toEqual(["account-2"]);
    expect(look.today).toEqual([seenOf("account-3")]);
    const stored = await runInDurableObject(roomStub(rooms, PLACE, 0), (_instance: Place, state) => state.storage.get(TODAY_KEY));
    expect(JSON.stringify(stored)).not.toContain(seenOf("account-1").name);
  });

  test("[account:player-deletes-account] [clock:busy-place-splits-rooms] given rooms of one and an account alone in the first room with a second socket in the next, when the place forgets the account, then both rooms let it go", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    const first = await openMember(rooms, "account-1", PLACE, "socket-1a");
    const second = await openMember(rooms, "account-1", PLACE, "socket-1b");
    expect(await roomCounts(rooms, PLACE)).toEqual([1, 1, 0]);

    await placePresenceStore(rooms).forget([PLACE], "account-1", seenOf("account-1").name);
    await until(() => first.closed !== null && second.closed !== null, "both sockets to close");

    expect(await roomCounts(rooms, PLACE)).toEqual([0]);
  });
});

describe("a room that empties before the rooms after it", () => {
  test("[clock:no-member-past-an-empty-room] [account:player-deletes-account] given rooms of one with members in rooms 0, 1 and 2, when room 1's member leaves and the place then forgets room 2's account, then room 2's socket is closed and the account is in no room", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    const store = placePresenceStore(rooms);
    const first = await openMember(rooms, "account-1", PLACE, "socket-1");
    await store.join(PLACE, "socket-2", member("account-2"));
    const third = await openMember(rooms, "account-3", PLACE, "socket-3");
    expect(await roomCounts(rooms, PLACE)).toEqual([1, 1, 1, 0]);

    await store.leave(PLACE, "socket-2");
    await store.forget([PLACE], "account-3", seenOf("account-3").name);

    await until(() => third.closed !== null, "room 2's socket to close");
    expect(first.closed).toBeNull();
    expect(await roomStub(rooms, PLACE, 2).count()).toBe(0);
  });

  test("[clock:no-member-past-an-empty-room] [clock:busy-place-splits-rooms] [clock:presence-is-a-sample] given rooms of one with members in rooms 0 and 1, when room 0's member leaves, then room 1's member is sent back to reconnect, and on reconnecting takes room 0, where the sample finds it", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    const store = placePresenceStore(rooms);
    await store.join(PLACE, "socket-1", member("account-1"));
    const second = await openMember(rooms, "account-2", PLACE, "socket-2");
    expect(await roomCounts(rooms, PLACE)).toEqual([1, 1, 0]);

    await store.leave(PLACE, "socket-1");

    await until(() => second.closed !== null, "room 1's socket to be sent back");
    expect(second.closed).toEqual({ code: CLOSE_REJOIN });
    expect(await roomStub(rooms, PLACE, 1).count()).toBe(0);
    await openMember(rooms, "account-2", PLACE, "socket-2-again");
    expect(await roomCounts(rooms, PLACE)).toEqual([1, 0]);
    expect((await lookAround(rooms, PLACE, null, 20, 0)).map((each) => each.account)).toEqual(["account-2"]);
  });

  test("[clock:no-member-past-an-empty-room] given rooms of one with members in rooms 0 to 3, when room 1's member leaves, then every room after it sends its member back and room 0's member stays", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    const store = placePresenceStore(rooms);
    const first = await openMember(rooms, "account-1", PLACE, "socket-1");
    await store.join(PLACE, "socket-2", member("account-2"));
    const later = [await openMember(rooms, "account-3", PLACE, "socket-3"), await openMember(rooms, "account-4", PLACE, "socket-4")];
    expect(await roomCounts(rooms, PLACE)).toEqual([1, 1, 1, 1, 0]);

    await store.leave(PLACE, "socket-2");

    await until(() => later.every((end) => end.closed !== null), "rooms 2 and 3 to send their members back");
    expect(later.map((end) => end.closed)).toEqual([{ code: CLOSE_REJOIN }, { code: CLOSE_REJOIN }]);
    expect(first.closed).toBeNull();
    expect([await roomStub(rooms, PLACE, 2).count(), await roomStub(rooms, PLACE, 3).count()]).toEqual([0, 0]);
    expect(await roomCounts(rooms, PLACE)).toEqual([1, 0]);
  });

  test("[clock:no-member-past-an-empty-room] [account:player-deletes-account] [city:players-shown-present-not-tracked] given rooms of one where room 1 emptied and room 2's member was sent back, both rooms listing who was there today, when the place forgets room 2's account, then its name is off room 2's list too", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    const store = placePresenceStore(rooms);
    await openMember(rooms, "account-1", PLACE, "socket-1");
    await store.join(PLACE, "socket-2", member("account-2"));
    const third = await openMember(rooms, "account-3", PLACE, "socket-3");
    await store.leave(PLACE, "socket-2");
    await until(() => third.closed !== null, "room 2's socket to be sent back");
    const listOf = (room: number) => runInDurableObject(roomStub(rooms, PLACE, room), (_instance: Place, state) => state.storage.get(TODAY_KEY));
    expect(JSON.stringify(await listOf(2))).toContain(seenOf("account-3").name);

    await store.forget([PLACE], "account-3", seenOf("account-3").name);

    expect(JSON.stringify(await listOf(2))).not.toContain(seenOf("account-3").name);
    expect(JSON.stringify(await listOf(1))).toContain(seenOf("account-2").name);
  });

  test("[clock:no-member-past-an-empty-room] given a room's name, when the next room is named, then it is the same place and scope with the number one higher, and a name that is no room's has none", () => {
    expect(nextRoomName("place.market#0")).toBe("place.market#1");
    expect(nextRoomName("test-4/place.market#9")).toBe("test-4/place.market#10");
    expect(nextRoomName("place.market")).toBeNull();
    expect(nextRoomName("place.market#01")).toBeNull();
    expect(nextRoomName("place.market#x")).toBeNull();
  });
});
