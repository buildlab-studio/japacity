/// <reference types="@cloudflare/vitest-plugin/types" />
import { PING, PONG, readNudge } from "@japacity/api";
import { runDurableObjectAlarm } from "cloudflare:test";
import type { Nudge } from "@japacity/store";
import { suiteForNudgeBus, suiteForPresenceStore } from "@japacity/store/contract";
import { describe, expect, test } from "vitest";

import { placePresenceStore } from "./place.presence";
import { roomCounts, roomStub } from "./place.rooms";
import { freshRooms, openMember, settle, until } from "./place.testing";
import { placeNudgeBus } from "./place.nudge";

const PLACE = "place.market";

// decision 0006 section 5: the store's contract suites, run against the place objects.
suiteForPresenceStore(() => Promise.resolve(placePresenceStore(freshRooms())));
suiteForNudgeBus(() => Promise.resolve(placeNudgeBus(freshRooms(), () => Promise.resolve(PLACE))));

describe("the nudge bus over the place objects", () => {
  test("[clock:socket-only-nudges] given an account with sockets in two rooms of its place, when it is nudged, then both sockets get it and no one else does", async () => {
    const rooms = freshRooms({ maxPerObject: 1 });
    const home = await openMember(rooms, "account-1", PLACE, "socket-a");
    const other = await openMember(rooms, "account-2");
    const tab = await openMember(rooms, "account-1", PLACE, "socket-b");
    const bus = placeNudgeBus(rooms, () => Promise.resolve(PLACE));

    expect(await roomCounts(rooms, PLACE)).toEqual([1, 1, 1, 0]);
    await bus.send("account-1", { nudge: "view", v: 4 });
    await settle();

    expect(home.texts).toEqual([JSON.stringify({ nudge: "view", v: 4 })]);
    expect(tab.texts).toEqual(home.texts);
    expect(other.texts).toEqual([]);
  });

  test("[clock:socket-only-nudges] given sockets that get every kind of nudge and a presence window, when every text they received is read, then each is one of the three nudges and carries no state", async () => {
    const rooms = freshRooms();
    const first = await openMember(rooms, "account-1");
    const second = await openMember(rooms, "account-2");
    const bus = placeNudgeBus(rooms, () => Promise.resolve(PLACE));
    const sent: Nudge[] = [{ nudge: "view", v: 12 }, { nudge: "messages" }, { nudge: "presence" }];

    for (const nudge of sent) {
      await bus.send("account-1", nudge);
      await bus.send("account-2", nudge);
    }
    await runDurableObjectAlarm(roomStub(rooms, PLACE, 0));
    first.end.send(PING);
    await until(() => first.texts.includes(PONG), "the ping's reply");

    // The ping's automatic reply is the protocol's, not the server's.
    const texts = [...first.texts, ...second.texts].filter((text) => text !== PONG);
    expect(texts.length).toBeGreaterThanOrEqual(2 * sent.length);
    for (const text of texts) expect(readNudge(text)).not.toBeNull();
    expect(first.texts.filter((text) => text !== PONG).slice(0, sent.length).map(readNudge)).toEqual(sent);
  });

  test("[clock:nudges-are-best-effort] given an account whose place is unknown, when it is nudged, then the nudge is dropped without an error", async () => {
    const rooms = freshRooms();
    const client = await openMember(rooms, "account-1");
    const bus = placeNudgeBus(rooms, () => Promise.resolve(null));

    await expect(bus.send("account-1", { nudge: "messages" })).resolves.toBeUndefined();
    await settle();
    expect(client.texts).toEqual([]);
  });

  test("[clock:nudges-are-best-effort] given a place lookup that fails, when an account is nudged, then the send still resolves", async () => {
    const bus = placeNudgeBus(freshRooms(), () => Promise.reject(new Error("database down")));

    await expect(bus.send("account-1", { nudge: "view", v: 1 })).resolves.toBeUndefined();
  });
});
