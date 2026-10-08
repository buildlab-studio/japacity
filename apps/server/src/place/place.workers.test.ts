/// <reference types="@cloudflare/vitest-plugin/types" />
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import type { Place } from "./place.object";
import { acceptedEnd, placePresenceStore } from "./place.presence";
import { lookAround, openSocket, roomCounts, roomLook, roomStub } from "./place.rooms";
import type { Rooms } from "./place.rooms";
import { ATTACHMENT_HEADER, attachmentBytes, CLOSE_POLICY, LIMITS_HEADER, NUDGE_EVERY_MS, PING, PONG, STATUS_FULL, STATUS_TOO_LARGE } from "./place.socket";
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
  test("[R-CLOCK-026] given three members on open sockets, when the object is evicted with its sockets hibernated, then the list comes back from the attachments", async () => {
    const rooms = freshRooms();
    const store = placePresenceStore(rooms);
    for (const account of ["account-1", "account-2", "account-3"]) await store.join(PLACE, `socket-${account}`, member(account));

    await evictDurableObject(roomStub(rooms, PLACE, 0));

    expect(await roomStub(rooms, PLACE, 0).count()).toBe(3);
    const shown = await store.sample(PLACE, 20, null, 0);
    expect(shown.map((each) => each.account).sort()).toEqual(["account-1", "account-2", "account-3"]);
    expect(shown.find((each) => each.account === "account-2")).toEqual(member("account-2"));
  });

  test("[R-CLOCK-025] [R-CITY-036] given members in a place, when the object's storage is read, then it holds only the day's list of names and looks", async () => {
    const rooms = freshRooms();
    await openMember(rooms, "account-1");
    await openMember(rooms, "account-2");

    const stored = await runInDurableObject(roomStub(rooms, PLACE, 0), (_instance: Place, state) => state.storage.list());

    expect([...stored.keys()]).toEqual([TODAY_KEY]);
    expect(stored.get(TODAY_KEY)).toEqual({ day: lagosDay(member("account-1").joinedAt), seen: [seenOf("account-1"), seenOf("account-2")] });
    for (const account of ["account-1", "account-2"]) expect(JSON.stringify(stored.get(TODAY_KEY))).not.toContain(JSON.stringify(account));
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(2);
  });

  test("[R-CLOCK-026] given attachments at the limit and one byte over, when each socket is opened, then the first is accepted and the second refused", async () => {
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

  test("[R-CLOCK-026] given a request that bypasses the router with an attachment over the limit, when the object reads it, then it refuses the socket", async () => {
    const rooms = freshRooms();
    const big: Attachment = { kind: "member", socket: "socket-big", member: { ...member("account-big"), name: "n".repeat(productionConfig.presence.attachmentBytes) } };

    const response = await roomStub(rooms, PLACE, 0).fetch("https://place/socket", {
      headers: { upgrade: "websocket", [ATTACHMENT_HEADER]: JSON.stringify(big), [LIMITS_HEADER]: JSON.stringify(rooms.limits) },
    });

    expect(response.status).toBe(STATUS_TOO_LARGE);
    await response.text();
    expect(await roomStub(rooms, PLACE, 0).count()).toBe(0);
  });

  test("[R-CLOCK-027] given two members, when one closes its socket from the client, then it leaves the list and the other stays", async () => {
    const rooms = freshRooms();
    const leaving = await openMember(rooms, "account-1");
    await openMember(rooms, "account-2");

    leaving.end.close(1000, "moved");
    await until(async () => (await roomStub(rooms, PLACE, 0).count()) === 1, "the close to reach the object");

    const shown = await lookAround(rooms, PLACE, null, 20, 0);
    expect(shown.map((each) => each.account)).toEqual(["account-2"]);
  });

  test("[R-CLOCK-028] given members coming and going, when the window passes, then each member gets one presence nudge and the next change waits a full window", async () => {
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

  test("[R-CLOCK-028] given more members than the sample, when the place is looked at, then the sample is the configured size and never shows the asker", async () => {
    const rooms = freshRooms();
    const size = productionConfig.presence.sample;
    for (let index = 0; index <= size + 1; index++) await openMember(rooms, `account-${String(index)}`);

    const shown = await lookAround(rooms, PLACE, "account-0", size, 99);

    expect(shown).toHaveLength(size);
    expect(shown.map((each) => each.account)).not.toContain("account-0");
  });

  test("[R-CLOCK-029] given rooms of three, when members join and one leaves, then each newcomer takes the fullest room with space and a full place opens the next room", async () => {
    const rooms = freshRooms({ maxPerObject: 3 });
    const store = placePresenceStore(rooms);
    for (let index = 1; index <= 7; index++) await store.join(PLACE, `socket-${String(index)}`, member(`account-${String(index)}`));

    expect(await roomCounts(rooms, PLACE)).toEqual([3, 3, 1, 0]);

    await store.leave(PLACE, "socket-5");
    expect(await roomCounts(rooms, PLACE)).toEqual([3, 2, 1, 0]);

    await store.join(PLACE, "socket-8", member("account-8"));
    expect(await roomCounts(rooms, PLACE)).toEqual([3, 3, 1, 0]);
  });

  test("[R-CLOCK-029] given a room at its cap, when a member is sent to it directly, then the object refuses it", async () => {
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

  test("[R-CLOCK-024] given a member's socket, when the client pings, then the automatic reply answers it", async () => {
    const rooms = freshRooms();
    const client = await openMember(rooms, "account-1");

    const pair = await runInDurableObject(roomStub(rooms, PLACE, 0), (_instance: Place, state) => state.getWebSocketAutoResponse());
    client.end.send(PING);
    await until(() => client.texts.includes(PONG), "the automatic reply");

    expect(pair?.request).toBe(PING);
    expect(pair?.response).toBe(PONG);
  });

  test("[R-SERVER-027] given a socket, when it sends the limit of messages and then one more, then it stays open at the limit and is closed with 1008 past it", async () => {
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
  test("[R-CITY-036] given todayMax members and then one more, when each joins, then the list holds todayMax and the first is dropped", async () => {
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

  test("[R-CITY-036] given players who were here and left, when the object is evicted, then the list comes back from storage", async () => {
    const rooms = freshRooms();
    await visit(rooms, "account-1", MIDNIGHT);
    await visit(rooms, "account-2", MIDNIGHT);

    await evictDurableObject(roomStub(rooms, PLACE, 0));

    expect(await roomStub(rooms, PLACE, 0).count()).toBe(0);
    const look = await roomLook(rooms, PLACE, null, productionConfig.presence.sample, 3, MIDNIGHT);
    expect(look.today.map((each) => each.name).sort()).toEqual(["Name account-1", "Name account-2"]);
  });

  test("[R-CITY-036] given players seen in the last minute before Lagos midnight, when the day turns, then they are gone and the next join starts a new list", async () => {
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

  test("[R-CITY-036] given a past day's list, when the presence alarm runs, then the list is deleted", async () => {
    const rooms = freshRooms();
    await visit(rooms, "account-1", 1_000);

    expect(await runDurableObjectAlarm(roomStub(rooms, PLACE, 0))).toBe(true);

    expect(await storedList(rooms)).toBeUndefined();
  });

  test("[R-CITY-036] [R-CLOCK-028] given players here now and others seen today, when the asker looks, then today holds none here now, never the asker, and fills only what the sample leaves", async () => {
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
});
