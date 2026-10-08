/// <reference types="@cloudflare/vitest-plugin/types" />
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { makeApp } from "../app";
import { productionConfig, testConfig } from "../config";
import { memoryStores, openLimiters, testSession } from "../deps";
import type { ServerDeps } from "../deps";
import { placePresenceStore } from "../place/place.presence";
import { roomCounts } from "../place/place.rooms";
import type { Rooms } from "../place/place.rooms";
import { freshRooms, listenTo, member } from "../place/place.testing";
import type { ServerConfig } from "../config";
import type { PresenceReply, ServerRejection } from "../types";
import { placeSocketRoutes } from "./place";

const PLACE = "place.agege";
const NOW = productionConfig.clock.epoch + 5_000;

interface Setup {
  app: ReturnType<typeof makeApp>;
  deps: ServerDeps;
  rooms: Rooms;
}

/** The app with the place objects, a test session, and characters that are where `places` says. */
function setup(places: Record<string, string>, config: ServerConfig = testConfig({ testing: { testLogin: true } })): Setup {
  let seed = 7;
  const rooms = freshRooms(config.presence);
  const deps: ServerDeps = {
    config,
    stores: { ...memoryStores(), presence: placePresenceStore(rooms) },
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed" },
    limits: openLimiters,
    session: testSession(config),
    now: () => NOW,
    randomBytes: (count) => Uint8Array.from({ length: count }, () => (seed = (seed * 48271) % 2147483647) & 255),
  };
  const app = makeApp(deps).route(
    "/",
    placeSocketRoutes(deps, {
      rooms,
      placeOf: (account) => Promise.resolve(places[account] ?? null),
      profileOf: (account) => Promise.resolve(Object.hasOwn(places, account) ? { name: `Name ${account}`, look: `look-${account}` } : null),
    }),
  );
  return { app, deps, rooms };
}

function socket(setupped: Setup, account: string | null, country: string | null = "NG", place = PLACE, upgrade = true): Promise<Response> {
  const headers: Record<string, string> = {};
  if (account !== null) headers["x-test-account"] = account;
  if (country !== null) headers["cf-ipcountry"] = country;
  if (upgrade) headers.upgrade = "websocket";
  return Promise.resolve(setupped.app.request(`/api/place/${place}/socket`, { headers }));
}

function presence(setupped: Setup, account: string | null, country = "NG", place = PLACE): Promise<Response> {
  const headers: Record<string, string> = { "cf-ipcountry": country };
  if (account !== null) headers["x-test-account"] = account;
  return Promise.resolve(setupped.app.request(`/api/place/${place}`, { headers }));
}

async function opened(response: Response): Promise<WebSocket> {
  expect(response.status).toBe(101);
  const end = response.webSocket;
  if (end === null) throw new Error("no socket");
  end.accept();
  return Promise.resolve(end);
}

async function refusal(response: Response): Promise<ServerRejection> {
  return response.json<ServerRejection>();
}

describe("the place routes", () => {
  test("[R-CLOCK-030] given no session, when the socket or the presence is asked for, then both are refused as signed out", async () => {
    const setupped = setup({ "account-1": PLACE });

    const opening = await socket(setupped, null);
    const fetched = await presence(setupped, null);

    expect(opening.status).toBe(401);
    expect((await refusal(opening)).code).toBe("signed-out");
    expect(fetched.status).toBe(401);
    expect((await refusal(fetched)).code).toBe("signed-out");
  });

  test("[R-CLOCK-030] given a signed-in account in a region that allows interaction, when it opens the socket, then it joins the place with its name, look and the server's time", async () => {
    const setupped = setup({ "account-1": PLACE });

    listenTo(await opened(await socket(setupped, "account-1", "NG")));

    expect(await setupped.deps.stores.presence.sample(PLACE, 20, null, 0)).toEqual([{ ...member("account-1", PLACE), joinedAt: NOW }]);
  });

  test("[R-CLOCK-030] [R-ACCOUNT-007] given a region whose policy is none, when the socket is asked for, then it is refused and the presence shows no other player", async () => {
    const setupped = setup({ "account-1": PLACE, "account-2": PLACE });
    listenTo(await opened(await socket(setupped, "account-2", "NG")));

    const opening = await socket(setupped, "account-1", "FR");
    const fetched = await presence(setupped, "account-1", "FR");

    expect(opening.status).toBe(403);
    expect((await refusal(opening)).code).toBe("region-closed");
    expect(await fetched.json()).toEqual({ place: PLACE, others: [] } satisfies PresenceReply);
    expect(await roomCounts(setupped.rooms, PLACE)).toEqual([1, 0]);
  });

  test("[R-ACCOUNT-010] given a row that needs a strong age check, which no account has passed, when the socket is asked for, then the row counts as none", async () => {
    const config = testConfig({ testing: { testLogin: true }, regions: { NG: { open: true, interaction: "matched", ageCheck: "verified" } } });
    const setupped = setup({ "account-1": PLACE }, config);

    const opening = await socket(setupped, "account-1", "NG");

    expect(opening.status).toBe(403);
    await opening.text();
  });

  test("[R-CLOCK-027] given a character in another place, when it asks for this place's socket, then it is refused", async () => {
    const setupped = setup({ "account-1": "place.ajah" });

    const opening = await socket(setupped, "account-1");

    expect(opening.status).toBe(409);
    expect((await refusal(opening)).code).toBe("not-legal");
  });

  test("given an account with no character, a place not in the content, or no upgrade, when the socket is asked for, then each is refused", async () => {
    const setupped = setup({ "account-1": PLACE });

    const noCharacter = await socket(setupped, "account-9");
    const unknownPlace = await socket(setupped, "account-1", "NG", "place.nowhere");
    const plainRequest = await socket(setupped, "account-1", "NG", PLACE, false);

    expect([noCharacter.status, unknownPlace.status, plainRequest.status]).toEqual([404, 404, 426]);
    expect((await refusal(noCharacter)).code).toBe("no-character");
    expect((await refusal(unknownPlace)).code).toBe("unknown-id");
    await plainRequest.text();
  });

  test("[R-CLOCK-028] given more players in the place than the sample, when one fetches the presence, then it gets the configured number of others, names and looks only, never itself", async () => {
    const size = productionConfig.presence.sample;
    const accounts = Array.from({ length: size + 3 }, (_unused, index) => `account-${String(index)}`);
    const setupped = setup(Object.fromEntries(accounts.map((account) => [account, PLACE])));
    for (const account of accounts) listenTo(await opened(await socket(setupped, account)));

    const reply = await (await presence(setupped, "account-0")).json<PresenceReply>();

    expect(reply.place).toBe(PLACE);
    expect(reply.others).toHaveLength(size);
    expect(reply.others.map((other) => other.name)).not.toContain("Name account-0");
    for (const other of reply.others) expect(Object.keys(other).sort()).toEqual(["look", "name"]);
  });

  test("[R-CLOCK-028] given the same players, when the presence is fetched twice, then the sample is drawn afresh", async () => {
    const accounts = Array.from({ length: 30 }, (_unused, index) => `account-${String(index)}`);
    const setupped = setup(Object.fromEntries(accounts.map((account) => [account, PLACE])));
    for (const account of accounts) listenTo(await opened(await socket(setupped, account)));

    const shown = new Set<string>();
    for (let fetch = 0; fetch < 4; fetch++) {
      const reply = await (await presence(setupped, "account-0")).json<PresenceReply>();
      shown.add(reply.others.map((other) => other.name).sort().join(","));
    }

    expect(shown.size).toBeGreaterThan(1);
  });

  test("[R-CLOCK-029] given rooms of two from the config, when three players open the socket, then the router fills the first room and opens the second", async () => {
    const config = testConfig({ testing: { testLogin: true }, presence: { maxPerObject: 2 } });
    const setupped = setup({ "account-1": PLACE, "account-2": PLACE, "account-3": PLACE }, config);

    for (const account of ["account-1", "account-2", "account-3"]) listenTo(await opened(await socket(setupped, account)));

    expect(await roomCounts(setupped.rooms, PLACE)).toEqual([2, 1, 0]);
  });
});
