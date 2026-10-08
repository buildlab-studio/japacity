import type { Nudge } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { readNudge } from "../nudge/place.nudge";
import { allowsInteraction, countryOf } from "../routes/place";
import { pickRoom, roomName } from "./place.rooms";
import { NUDGE_EVERY_MS, nudgeText, parseAttachment, parseLimits, tagsFor } from "./place.socket";
import type { Attachment } from "./place.socket";

const MEMBER: Attachment = {
  kind: "member",
  socket: "socket-1",
  member: { account: "account-1", name: "Ada", look: "look-1", place: "place.agege", joinedAt: 5 },
};

describe("the place object's plain parts", () => {
  test("[R-CLOCK-029] given rooms at, under and over the cap, when a room is picked, then it is the fullest with space, else the next room", () => {
    expect(pickRoom([0], 3)).toBe(0);
    expect(pickRoom([3, 0], 3)).toBe(1);
    expect(pickRoom([3, 2, 1, 0], 3)).toBe(1);
    expect(pickRoom([2, 2, 0], 3)).toBe(0);
    expect(pickRoom([3, 3, 3], 3)).toBe(3);
    expect(pickRoom([1, 3, 0], 1)).toBe(2);
    expect(pickRoom([], 3)).toBe(0);
  });

  test("[R-CLOCK-029] given every list of up to four rooms of up to three members, when a room is picked, then it has space and no room with space is fuller", () => {
    const max = 3;
    let lists: number[][] = [[]];
    for (let length = 1; length <= 4; length++) {
      lists = [...lists, ...lists.filter((list) => list.length === length - 1).flatMap((list) => [0, 1, 2, 3].map((count) => [...list, count]))];
    }
    for (const counts of lists) {
      const room = pickRoom(counts, max);
      const count = counts[room] ?? 0;
      expect(count).toBeLessThan(max);
      expect(counts.filter((other) => other < max && other > count)).toEqual([]);
    }
  });

  test("[R-CLOCK-029] given a place, when its rooms are named, then each number is its own object and the scope comes first", () => {
    expect(roomName("", "place.agege", 0)).toBe("place.agege#0");
    expect(roomName("test-1/", "place.agege", 2)).toBe("test-1/place.agege#2");
  });

  test("[R-CLOCK-026] given an attachment, when it is sent as text and read back, then it is the same, and a malformed one is refused", () => {
    const listener: Attachment = { kind: "listener", socket: "socket-2", account: "account-2" };

    expect(parseAttachment(JSON.stringify(MEMBER))).toEqual(MEMBER);
    expect(parseAttachment(JSON.stringify(listener))).toEqual(listener);
    expect(parseAttachment(null)).toBeNull();
    expect(parseAttachment("not json")).toBeNull();
    expect(parseAttachment(JSON.stringify({ ...MEMBER, socket: "" }))).toBeNull();
    expect(parseAttachment(JSON.stringify({ ...MEMBER, member: { ...MEMBER.member, joinedAt: "5" } }))).toBeNull();
    expect(parseLimits(JSON.stringify({ maxPerObject: 3, attachmentBytes: 1024, todayMax: 20 }))).toEqual({ maxPerObject: 3, attachmentBytes: 1024, todayMax: 20 });
    expect(parseLimits(JSON.stringify({ maxPerObject: 3, attachmentBytes: 1024 }))).toBeNull();
    expect(parseLimits("{}")).toBeNull();
  });

  test("[R-CLOCK-020] given a socket's attachment, when it is tagged, then a nudge can find it by account and a leave by socket", () => {
    expect(tagsFor(MEMBER)).toEqual(["member", "account:account-1", "socket:socket-1"]);
  });

  test("[R-CLOCK-020] given each kind of nudge, when it is written and read back, then it is the nudge itself and nothing more", () => {
    const nudges: Nudge[] = [{ nudge: "view", v: 3 }, { nudge: "messages" }, { nudge: "presence" }];
    for (const nudge of nudges) expect(readNudge(nudgeText(nudge))).toEqual(nudge);
    expect(nudgeText({ nudge: "view", v: 3, state: { cash: 1 } } as unknown as Nudge)).toBe('{"nudge":"view","v":3}');
    expect(readNudge('{"nudge":"view","v":3,"state":{}}')).toBeNull();
    expect(readNudge('{"nudge":"messages","v":3}')).toBeNull();
    expect(readNudge('{"nudge":"view"}')).toBeNull();
    expect(readNudge("pong")).toBeNull();
  });

  test("[R-CLOCK-028] given the production config, when the object's window is read, then it is the configured presence window", () => {
    expect(NUDGE_EVERY_MS).toBe(productionConfig.presence.nudgeEveryMs);
  });

  test("[R-CLOCK-030] [R-ACCOUNT-010] given each policy row, when it is asked whether players meet, then only an open interaction without a strong age check allows it", () => {
    expect(allowsInteraction({ open: true, interaction: "none", ageCheck: "declared" })).toBe(false);
    expect(allowsInteraction({ open: true, interaction: "invited", ageCheck: "declared" })).toBe(true);
    expect(allowsInteraction({ open: true, interaction: "matched", ageCheck: "declared" })).toBe(true);
    expect(allowsInteraction({ open: true, interaction: "free-text", ageCheck: "verified" })).toBe(false);
  });

  test("[R-ACCOUNT-008] given a request, when its country is read, then Cloudflare's own property wins over the header", () => {
    const withHeader = new Request("https://server/api/place/x", { headers: { "cf-ipcountry": "GB" } });
    const withProperty = Object.assign(new Request("https://server/api/place/x", { headers: { "cf-ipcountry": "GB" } }), { cf: { country: "NG" } });

    expect(countryOf(withHeader)).toBe("GB");
    expect(countryOf(withProperty)).toBe("NG");
    expect(countryOf(new Request("https://server/api/place/x"))).toBeNull();
  });
});
