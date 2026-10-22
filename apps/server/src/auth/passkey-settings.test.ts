// The account sheet's passkeys and ways out, through the real auth library: the name a new passkey carries in the
// phone's list, adding one from a session past the fresh age once a code has confirmed it in place
// (account:passkey-added-in-place), and signing out here or on every phone (account:sign-out-ends-the-session).
import { afterEach, describe, expect, test, vi } from "vitest";

import { forgettingPresence } from "../app.testing";
import { memoryStores } from "../dependencies";
import { softwarePasskey } from "./passkey.testing";
import { harness, makeJar } from "./auth.testing";
import type { Harness, Jar } from "./auth.testing";

afterEach(() => {
  vi.useRealTimers();
});

async function signedInAgain(h: Harness, email: string, jar: Jar = makeJar()): Promise<Jar> {
  const otp = await h.codeFor(email, jar);
  const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email, otp } });
  expect(reply.status).toBe(200);
  return jar;
}

const playing = async (h: Harness, jar: Jar) => (await h.call("/api/account", { jar })).status;

describe("adding a passkey (account:passkey-added-in-place)", () => {
  test("[account:passkey-added-in-place] given a kept life, when a passkey's options are asked for, then the phone is given the account's email as its name, and the stored passkey keeps no name of its own", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const asked = await h.call("/api/auth/passkey/generate-register-options", { jar });
    const options = await asked.json<{ user: { name: string; displayName: string } }>();
    expect({ name: options.user.name, displayName: options.user.displayName }).toEqual({ name: "ada@example.com", displayName: "ada@example.com" });
    expect((await (await softwarePasskey()).register(h, jar)).status).toBe(200);
    const stored = h.tables.passkey.filter((row) => row["userId"] === account);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.["name"] ?? null).toBeNull();
  });

  test("[account:passkey-added-in-place] given a session past the fresh age, when a passkey is added, then it is refused as not fresh; once a code confirms it in the same browser, the same account adds it without signing out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-18T09:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    vi.setSystemTime(start + h.deps.config.account.deleteFreshMs + 1000);
    const stale = await (await softwarePasskey("c3RhbGUta2V5")).register(h, jar);
    expect({ status: stale.options, code: stale.body["code"] }).toEqual({ status: 403, code: "SESSION_NOT_FRESH" });
    expect(h.tables.passkey).toEqual([]);
    await signedInAgain(h, "ada@example.com", jar);
    const fresh = await (await softwarePasskey("ZnJlc2gta2V5")).register(h, jar);
    expect(fresh.status).toBe(200);
    expect(h.tables.passkey.map((row) => row["userId"])).toEqual([account]);
    expect(await playing(h, jar)).toBe(200);
  });
});

describe("signing out (account:sign-out-ends-the-session)", () => {
  test("[account:sign-out-ends-the-session] given a kept life signed in on two phones, when this one signs out, then its session ends on the server and the other plays on", async () => {
    const h = harness();
    const { jar } = await h.signUp("ada@example.com");
    const other = await signedInAgain(h, "ada@example.com");
    const before = h.tables.session.length;
    expect((await h.call("/api/auth/sign-out", { method: "POST", jar, json: {} })).status).toBe(200);
    expect(h.tables.session).toHaveLength(before - 1);
    expect(await playing(h, jar)).toBe(401);
    expect(await playing(h, other)).toBe(200);
  });

  test("[account:sign-out-ends-the-session] given a kept life signed in on two phones, when it signs out on every phone, then every session of the account ends, this one too, and another account's goes on", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const other = await signedInAgain(h, "ada@example.com");
    const stranger = await h.signUp("bola@example.com");
    expect((await h.call("/api/auth/revoke-sessions", { method: "POST", jar, json: {} })).status).toBe(200);
    expect(h.tables.session.filter((row) => row["userId"] === account)).toEqual([]);
    expect(await playing(h, jar)).toBe(401);
    expect(await playing(h, other)).toBe(401);
    expect(await playing(h, stranger.jar)).toBe(200);
  });

  test("[account:sign-out-ends-the-session] [account:player-deletes-account] given a kept life standing in a place, when it signs out on this phone, then its socket is left to the phone; when it signs out on every phone, then its sockets close and its name leaves the day's list", async () => {
    const presence = forgettingPresence();
    const h = harness({ stores: { ...memoryStores(), presence } });
    const { jar, account } = await h.signUp("ada@example.com");
    const other = await signedInAgain(h, "ada@example.com");
    const username = (await h.deps.stores.account.get(account))?.username ?? "";
    await presence.join("place.ojuelegba", "socket-1", { account, name: username, look: "person_ada", place: "place.ojuelegba", joinedAt: 0 });

    expect((await h.call("/api/auth/sign-out", { method: "POST", jar, json: {} })).status).toBe(200);
    expect(presence.forgotten).toEqual([]);
    expect((await h.call("/api/auth/revoke-sessions", { method: "POST", jar: other, json: {} })).status).toBe(200);

    expect(username).not.toBe("");
    expect(presence.forgotten).toEqual([{ account, name: username, places: expect.arrayContaining(["place.ojuelegba"]) as string[] }]);
    expect(await presence.sample("place.ojuelegba", 20, null, 0)).toEqual([]);
  });
});
