import type { ServerReply, ViewReply } from "@japacity/api";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GOOGLE_PROFILE, harness, makeJar, withGoogle } from "../auth/auth.testing";
import type { GoogleRoundTrip, Harness, Jar } from "../auth/auth.testing";
import { testConfig } from "../config";
import { addressKey as connectionOf } from "../limits/address";
import { memoryLimiters } from "../limits/memory";
import { PASS_COOKIE, PASS_PREFIX } from "./age";
import { BOARDS_DETAIL, DEVICE_COOKIE, SECURED_PATHS } from "./guest";
import { METHOD_TAKEN } from "./link";
import { TURNSTILE_TEST } from "./turnstile";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function body(reply: Response): Promise<Record<string, unknown>> {
  return reply.json<Record<string, unknown>>();
}

/** This file's Google round trip: back to the root, Google sharing a name and photo. */
const SHARING: GoogleRoundTrip = { callbackURL: "/", answer: GOOGLE_PROFILE };

/** A character for the jar's account, and one month played. Returns the view after it. */
async function playAMonth(h: Harness, jar: Jar): Promise<Extract<ViewReply, { ok: true }>> {
  expect((await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.graduate" } })).status).toBe(200);
  const first = await (await h.call("/api/view", { jar })).json<ViewReply>();
  if (!first.ok) throw new Error(first.detail);
  const sent = await (await h.call("/api/command", { method: "POST", jar, json: { command: { type: "turn/end", slots: [], basedOn: first.view.v }, basedOn: first.view.v } })).json<ServerReply>();
  expect(sent).toMatchObject({ ok: true, view: { v: first.view.v + 1 } });
  const after = await (await h.call("/api/view", { jar })).json<ViewReply>();
  if (!after.ok) throw new Error(after.detail);
  return after;
}

/** Everything the stores and the library hold about one account, to compare before and after. */
async function lifeOf(h: Harness, account: string) {
  const row = await h.deps.stores.account.get(account);
  const character = row?.character ?? null;
  return {
    row,
    held: character === null ? null : await h.deps.stores.player.load(character),
    deletion: await h.deps.stores.deletion.due(Number.MAX_SAFE_INTEGER),
  };
}

describe("the guest start", () => {
  test("[account:guest-and-secured-states] given a passed age screen and a username, when the guest life is started, then the account is a guest with the username and no email, no password and no method", async () => {
    const h = harness();
    const { jar, account } = await h.guest(makeJar(), { username: "Ada_Lagos" });

    const me = await body(await h.call("/api/account", { jar }));
    expect(me).toMatchObject({ ok: true, account: { id: account, state: "guest", username: "Ada_Lagos", renameFrom: 0, character: null } });
    expect(h.tables.user).toEqual([expect.objectContaining({ id: account, name: "", emailVerified: false, isAnonymous: true })]);
    expect(String(h.tables.user[0]?.["email"])).toMatch(/\.invalid$/);
    expect(h.tables.account).toEqual([]);
    expect(jar.cookies.has(PASS_COOKIE)).toBe(false);
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(PASS_PREFIX))).toEqual([]);
  });

  test("[account:guest-and-secured-states] [account:age-screen-refuses-minors] given no age pass, when a guest life is asked for, then it is refused and nothing is made", async () => {
    const h = harness();
    const reply = await h.startGuest(makeJar());
    expect(reply.status).toBe(403);
    expect(await body(reply)).toMatchObject({ ok: false, code: "expired" });
    expect(h.tables.user).toEqual([]);
  });

  test("[account:guest-and-secured-states] given a browser that already holds a life, when it asks for another guest life, then it is refused and keeps the one it has", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    await h.passAge(jar);
    const again = await h.startGuest(jar);
    expect(again.status).toBe(409);
    expect(await body(await h.call("/api/account", { jar }))).toMatchObject({ account: { id: account } });
    expect(h.tables.user).toHaveLength(1);
  });

  test("[account:guest-and-secured-states] given a guest that rests for 300 days, when it comes back, then its session still opens its life: it is the only way back", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-09T19:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const { jar, account } = await h.guest();
    vi.setSystemTime(start + 300 * time.DAY_MS);
    expect(await body(await h.call("/api/account", { jar }))).toMatchObject({ ok: true, account: { id: account, state: "guest" } });
  });

  test("[account:player-deletes-account] [account:guest-and-secured-states] given a guest whose session is a day old, when it deletes its account, then its own session confirms it, every session ends and the deletion is recorded", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-09T19:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const { jar, account } = await h.guest();
    vi.setSystemTime(start + time.DAY_MS);
    const reply = await h.call("/api/account", { method: "DELETE", jar, json: {} });
    expect(reply.status).toBe(200);
    expect(await body(reply)).toMatchObject({ ok: true, dueAt: start + time.DAY_MS + h.deps.config.account.deleteWithinDays * time.DAY_MS });
    expect(h.tables.session).toEqual([]);
    expect(h.tables.user).toEqual([]);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
    expect(await h.deps.stores.deletion.due(Number.MAX_SAFE_INTEGER)).toEqual([expect.objectContaining({ account })]);
  });

  test("[account:play-starts-without-email] given a new guest, when its life is started, then no email is sent and none is waiting to be sent", async () => {
    const h = harness();
    await h.guest();
    expect(h.sent).toEqual([]);
    expect(h.background).toEqual([]);
  });
});

describe("the bot check at the guest start", () => {
  test("[account:bot-check-on-guest-creation] given Turnstile's always-pass test secret and its dummy token, when the guest life is started, then it is made, and the age screen asked for no token", async () => {
    const h = harness({ turnstileSecret: TURNSTILE_TEST.passSecret });
    const jar = makeJar();
    expect((await h.call("/api/age", { method: "POST", jar, json: { dateOfBirth: "1990-05-17" } })).status).toBe(200);
    expect((await h.startGuest(jar, { token: TURNSTILE_TEST.dummyToken })).status).toBe(200);
  });

  test("[account:bot-check-on-guest-creation] given a missing, failed or spent token, when the guest life is started, then no account is made and the age pass is still there to try again", async () => {
    const cases = [
      { secret: TURNSTILE_TEST.passSecret, token: "" },
      { secret: TURNSTILE_TEST.failSecret, token: TURNSTILE_TEST.dummyToken },
      { secret: TURNSTILE_TEST.spentSecret, token: TURNSTILE_TEST.dummyToken },
    ];
    for (const { secret, token } of cases) {
      const h = harness({ turnstileSecret: secret });
      const jar = makeJar();
      await h.passAge(jar);
      const reply = await h.startGuest(jar, { token });
      expect(reply.status).toBe(403);
      expect(await body(reply)).toMatchObject({ code: "bot-check" });
      expect(h.tables.user).toEqual([]);
      expect(jar.cookies.has(PASS_COOKIE)).toBe(true);
      expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(PASS_PREFIX))).toHaveLength(1);
    }
  });

  test("[account:bot-check-on-guest-creation] given a token Turnstile says was solved on another host, when the guest life is started, then the check fails and no account is made", async () => {
    for (const host of ["elsewhere.example", "japacity.test.elsewhere.example", ""]) {
      const h = harness({ turnstileHost: host });
      const jar = makeJar();
      await h.passAge(jar);
      const reply = await h.startGuest(jar, { token: TURNSTILE_TEST.dummyToken });
      expect({ host, status: reply.status }).toEqual({ host, status: 403 });
      expect(await body(reply)).toMatchObject({ code: "bot-check", detail: "hostname-mismatch" });
      expect(h.tables.user).toEqual([]);
    }
  });

  test("[account:bot-check-on-guest-creation] given a token Turnstile says was made for another action, when the guest life is started, then the check fails and no account is made", async () => {
    for (const action of ["login", ""]) {
      const h = harness({ turnstileAction: action });
      const jar = makeJar();
      await h.passAge(jar);
      const reply = await h.startGuest(jar, { token: TURNSTILE_TEST.dummyToken });
      expect({ action, status: reply.status }).toEqual({ action, status: 403 });
      expect(await body(reply)).toMatchObject({ code: "bot-check", detail: "action-mismatch" });
      expect(h.tables.user).toEqual([]);
    }
  });

  test("[account:bot-check-on-guest-creation] given one pass, when two browsers start a guest life with it, then the second is refused", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const copy = makeJar();
    copy.cookies.set(PASS_COOKIE, jar.cookies.get(PASS_COOKIE) ?? "");
    expect((await h.startGuest(jar)).status).toBe(200);
    const second = await h.startGuest(copy);
    expect(second.status).toBe(403);
    expect(await body(second)).toMatchObject({ code: "expired" });
    expect(h.tables.user).toHaveLength(1);
  });

  test("[account:bot-check-on-guest-creation] given a browser that calls the library's anonymous sign-in itself, when it skips the guest start, then it is refused and no account is made", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const reply = await h.call("/api/auth/sign-in/anonymous", { method: "POST", jar, headers: { "x-japacity-guest-name": "sneaky_one" }, json: {} });
    expect(reply.status).toBe(404);
    expect(h.tables.user).toEqual([]);
    expect((await h.auth.handler(new Request("https://japacity.test/api/auth/sign-in/anonymous", { method: "POST", headers: { "content-type": "application/json", "x-japacity-guest-name": "sneaky_one" }, body: "{}" }))).status).toBe(404);
    expect(h.tables.user).toEqual([]);
  });

  test("[account:bot-check-on-guest-creation] given a secured account, when it signs in again on another browser with no pass and no token, then no bot check is asked", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const fresh = makeJar();
    const otp = await h.codeFor("ada@example.com", fresh, "198.51.100.40");
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: fresh, ip: "198.51.100.40", json: { email: "ada@example.com", otp } });
    expect(reply.status).toBe(200);
    expect(await body(await h.call("/api/account", { jar: fresh }))).toMatchObject({ account: { id: account } });
  });

  test("[account:sign-in-without-secret] given no guest life, when a new email or a new Google account signs in at the door, then no account is made: a life starts as a guest", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const otp = await h.codeFor("new@example.com", jar);
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email: "new@example.com", otp } });
    expect(reply.status).toBe(403);
    expect(await body(reply)).toMatchObject({ code: "no-account" });
    const back = await withGoogle(h, jar, { sub: "google-new", email: "fresh@example.com" }, SHARING);
    expect(back.searchParams.get("error")).toBe("no-account");
    expect(h.tables.user).toEqual([]);
  });
});

describe("what only a secured account may do", () => {
  const SECURE = /Secure this life with Google or an email code/;

  async function guestAndSecured(h: Harness) {
    const guest = await h.guest();
    const secured = await h.signUp("bola@example.com");
    return { guest, secured };
  }

  /** What a reply says about a secured-only refusal: its status, its code, and whether its detail names the way to secure. */
  async function outcome(reply: Response) {
    const said = (await reply.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: reply.status, code: said["code"], secure: SECURE.test(String(said["detail"])) };
  }

  const GUEST_ONLY = { status: 403, code: "guest-only", secure: true };

  const command = (type: string) => ({ command: { type, tickets: 1, basedOn: 0 }, basedOn: 0 });

  test("[account:social-needs-secured-account] given a guest, when it buys lottery tickets, then it is refused guest-only with the way to secure; a secured account is let through", async () => {
    const h = harness();
    const { guest, secured } = await guestAndSecured(h);
    expect(await outcome(await h.call("/api/command", { method: "POST", jar: guest.jar, json: command("lottery/buy") }))).toEqual(GUEST_ONLY);
    expect((await outcome(await h.call("/api/command", { method: "POST", jar: secured.jar, json: command("lottery/buy") }))).code).not.toBe("guest-only");
  });

  // The gate guards the boards the client reads, `/api/boards/...`.
  test("[account:social-needs-secured-account] given a guest, when it reads any board, then it is refused guest-only at the gate; a secured account is let through", async () => {
    const h = harness();
    const { guest, secured } = await guestAndSecured(h);
    expect(SECURED_PATHS.filter((path) => path.path.includes("board"))).toEqual([{ path: "/api/boards/*", method: "GET", detail: BOARDS_DETAIL }]);
    for (const path of ["/api/boards/this-week/everyone", "/api/boards/all-time/everyone", "/api/boards/this-week/friends", "/api/boards/all-time/friends", "/api/boards/joined-week"]) {
      expect(await outcome(await h.call(path, { jar: guest.jar }))).toEqual(GUEST_ONLY);
      expect((await outcome(await h.call(path, { jar: secured.jar }))).code).not.toBe("guest-only");
    }
  });

  test("[account:social-needs-secured-account] given a guest, when it makes an invite card or a partner invite, then each is refused guest-only; a secured account is let through", async () => {
    const h = harness();
    const { guest, secured } = await guestAndSecured(h);
    expect(await outcome(await h.call("/api/invite", { method: "POST", jar: guest.jar, json: { slot: "partner" } }))).toEqual(GUEST_ONLY);
    expect(await outcome(await h.call("/api/command", { method: "POST", jar: guest.jar, json: command("people/invite") }))).toEqual(GUEST_ONLY);
    expect((await outcome(await h.call("/api/invite", { method: "POST", jar: secured.jar, json: { slot: "partner" } }))).code).not.toBe("guest-only");
    expect((await outcome(await h.call("/api/command", { method: "POST", jar: secured.jar, json: command("people/invite") }))).code).not.toBe("guest-only");
  });

  test("[account:social-needs-secured-account] given a guest, when it takes a friend's invite, then it is refused guest-only; a secured account is let through", async () => {
    const h = harness();
    const { guest, secured } = await guestAndSecured(h);
    expect(await outcome(await h.call("/api/invite/some-card/accept", { method: "POST", jar: guest.jar, json: { slot: "partner" } }))).toEqual(GUEST_ONLY);
    expect((await outcome(await h.call("/api/invite/some-card/accept", { method: "POST", jar: secured.jar, json: { slot: "partner" } }))).code).not.toBe("guest-only");
  });

  test("[account:social-needs-secured-account] given a guest, when it sends or reads messages, then both are refused guest-only; a secured account is let through", async () => {
    const h = harness();
    const { guest, secured } = await guestAndSecured(h);
    expect(await outcome(await h.call("/api/pair/pair.1/say", { method: "POST", jar: guest.jar, json: { phrase: "phrase.hello" } }))).toEqual(GUEST_ONLY);
    expect(await outcome(await h.call("/api/pair/pair.1/conversation", { jar: guest.jar }))).toEqual(GUEST_ONLY);
    expect((await outcome(await h.call("/api/pair/pair.1/say", { method: "POST", jar: secured.jar, json: { phrase: "phrase.hello" } }))).code).not.toBe("guest-only");
    expect((await outcome(await h.call("/api/pair/pair.1/conversation", { jar: secured.jar }))).code).not.toBe("guest-only");
  });

  test("[account:social-needs-secured-account] given a guest's life, when another browser signs in to it by its placeholder address, then it is refused guest-only: a guest life is restored on no other device", async () => {
    const h = harness();
    const { account } = await h.guest();
    const placeholder = String(h.tables.user.find((row) => row["id"] === account)?.["email"]);
    const other = makeJar();
    const otp = await h.codeFor(placeholder, other, "198.51.100.50");
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: other, ip: "198.51.100.50", json: { email: placeholder, otp } });
    expect(reply.status).toBe(403);
    const said = await body(reply);
    expect(said).toMatchObject({ code: "guest-only" });
    expect(String(said["message"])).toMatch(/Secure it there/);
    expect((await h.call("/api/account", { jar: other })).status).toBe(401);
  });

  test("[account:social-needs-secured-account] given a guest, when it plays its own life and reads the world and the news, then nothing is refused", async () => {
    const h = harness();
    const { jar } = await h.guest();
    const after = await playAMonth(h, jar);
    expect(after.view.news).toBeDefined();
    expect((await h.call("/api/world", { jar })).status).toBe(200);
  });
});

describe("securing a guest", () => {
  test("[account:guest-secures-the-life] given a guest that played a month, when it secures with an email code, then the same account holds the same life, the same save and the same clock", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const played = await playAMonth(h, jar);
    const before = await lifeOf(h, account);

    const secured = await h.secureByCode(jar, "ada@example.com");
    expect(secured.status).toBe(200);

    const after = await lifeOf(h, account);
    expect(after).toEqual({ ...before, row: { ...before.row, state: "secured" } });
    const view = await (await h.call("/api/view", { jar })).json<ViewReply>();
    expect(view).toEqual(played);
    expect(h.tables.user).toEqual([expect.objectContaining({ id: account, email: "ada@example.com", emailVerified: true, isAnonymous: false })]);
    expect(h.tables.session.map((row) => row["userId"])).toEqual([account]);
  });

  test("[account:social-needs-secured-account] [account:guest-secures-the-life] given a guest that played a month, when it secures with an email code, then its board row, written unlisted while it was a guest, is listed at once", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    await playAMonth(h, jar);
    const character = (await h.deps.stores.account.get(account))?.character ?? "";
    expect(await h.deps.stores.boards.get(character)).toMatchObject({ account, listed: false });

    expect((await h.secureByCode(jar, "ada@example.com")).status).toBe(200);
    expect(await h.deps.stores.boards.get(character)).toMatchObject({ account, listed: true });
  });

  test("[account:guest-secures-the-life] given a guest that played a month, when it secures with Google, then the same account holds the same life, and it signs in from another browser with Google", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const played = await playAMonth(h, jar);
    const before = await lifeOf(h, account);

    const back = await withGoogle(h, jar, { sub: "google-ada", email: "ada@example.com" }, SHARING);
    expect(back.searchParams.get("error")).toBeNull();

    expect(await lifeOf(h, account)).toEqual({ ...before, row: { ...before.row, state: "secured" } });
    expect(await (await h.call("/api/view", { jar })).json<ViewReply>()).toEqual(played);
    const elsewhere = makeJar();
    await withGoogle(h, elsewhere, { sub: "google-ada", email: "ada@example.com" }, SHARING);
    expect(await body(await h.call("/api/account", { jar: elsewhere }))).toMatchObject({ account: { id: account, state: "secured" } });
  });

  test("[account:guest-secures-the-life] given an email that already has an account, when a guest secures with it, then the guest is told it is taken and neither life changes", async () => {
    const h = harness();
    const owner = await h.signUp("ada@example.com");
    await playAMonth(h, owner.jar);
    const { jar, account } = await h.guest();
    await playAMonth(h, jar);
    const ownerBefore = await lifeOf(h, owner.account);
    const guestBefore = await lifeOf(h, account);
    const usersBefore = structuredClone(h.tables.user);
    const sessionsBefore = h.tables.session.length;

    const reply = await h.secureByCode(jar, "ada@example.com", "198.51.100.60");

    expect(reply.status).toBe(403);
    expect(await body(reply)).toMatchObject({ code: METHOD_TAKEN });
    expect(await lifeOf(h, owner.account)).toEqual(ownerBefore);
    expect(await lifeOf(h, account)).toEqual(guestBefore);
    expect(h.tables.user).toEqual(usersBefore);
    expect(h.tables.session).toHaveLength(sessionsBefore);
    expect(await body(await h.call("/api/account", { jar }))).toMatchObject({ account: { id: account, state: "guest" } });
  });

  test("[account:guest-secures-the-life] given a Google account that already has a life, or whose email does, when a guest secures with it, then the guest is sent back told it is taken and neither life changes or joins", async () => {
    const h = harness();
    const owner = await h.guest();
    await withGoogle(h, owner.jar, { sub: "google-owner", email: "owner@example.com" }, SHARING);
    const byEmail = await h.signUp("bola@example.com");
    const { jar, account } = await h.guest();
    const before = { owner: await lifeOf(h, owner.account), byEmail: await lifeOf(h, byEmail.account), guest: await lifeOf(h, account) };
    const methodsBefore = structuredClone(h.tables.account);

    for (const identity of [{ sub: "google-owner", email: "owner@example.com" }, { sub: "google-bola", email: "bola@example.com" }]) {
      const back = await withGoogle(h, jar, identity, SHARING);
      expect(back.searchParams.get("error")).toBe(METHOD_TAKEN);
    }

    expect({ owner: await lifeOf(h, owner.account), byEmail: await lifeOf(h, byEmail.account), guest: await lifeOf(h, account) }).toEqual(before);
    expect(h.tables.account.map((row) => [row["userId"], row["providerId"], row["accountId"]])).toEqual(methodsBefore.map((row) => [row["userId"], row["providerId"], row["accountId"]]));
    expect(await body(await h.call("/api/account", { jar }))).toMatchObject({ account: { id: account, state: "guest" } });
  });

  test("[account:guest-secures-the-life] [account:passkey-needs-signed-in-session] given a guest, when it asks to register a passkey, then it is refused guest-only; once secured it may", async () => {
    const h = harness();
    const { jar } = await h.guest();
    const refused = await h.call("/api/auth/passkey/generate-register-options", { jar });
    expect(refused.status).toBe(403);
    expect(await body(refused)).toMatchObject({ code: "guest-only" });
    expect((await h.secureByCode(jar, "ada@example.com")).status).toBe(200);
    expect((await h.call("/api/auth/passkey/generate-register-options", { jar })).status).toBe(200);
  });
});

describe("an email that was never confirmed", () => {
  test("[account:username-and-unconfirmed-email] given a guest that asked for a code and never typed it, when the address is used elsewhere, then it signs in to nothing, reserves nothing, and is dropped once its owner confirms it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-09T19:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const first = await h.guest();
    const unconfirmed = await h.codeFor("ada@example.com", first.jar, "198.51.100.70");

    // It cannot sign in or recover: from another browser the address opens no life.
    const stranger = makeJar();
    await h.passAge(stranger);
    // The library finds the newest code by its creation time; two in one millisecond tie.
    vi.setSystemTime(start + 1_000);
    const otp = await h.codeFor("ada@example.com", stranger, "198.51.100.71");
    const signIn = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: stranger, ip: "198.51.100.71", json: { email: "ada@example.com", otp } });
    expect(await body(signIn)).toMatchObject({ code: "no-account" });
    expect((await h.call("/api/account", { jar: stranger })).status).toBe(401);

    // It reserves nothing: another guest secures with it.
    const owner = await h.guest();
    vi.setSystemTime(start + 2_000);
    expect((await h.secureByCode(owner.jar, "ada@example.com", "198.51.100.72")).status).toBe(200);

    // The claim is dropped: the first guest's code no longer works, and a new one is told the address is taken.
    vi.setSystemTime(start + 60_000);
    const old = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: first.jar, ip: "198.51.100.73", json: { email: "ada@example.com", otp: unconfirmed } });
    expect(old.status).toBeGreaterThanOrEqual(400);
    const again = await h.secureByCode(first.jar, "ada@example.com", "198.51.100.74");
    expect(await body(again)).toMatchObject({ code: METHOD_TAKEN });
    expect(await body(await h.call("/api/account", { jar: first.jar }))).toMatchObject({ account: { id: first.account, state: "guest" } });
    expect(await body(await h.call("/api/account", { jar: owner.jar }))).toMatchObject({ account: { id: owner.account, state: "secured" } });
  });
});

describe("the flood limits on guests", () => {
  const limits = { guestsPerDevice: 2, guestsPerConnection: 3, guestWindowHours: 24 };

  test("[account:guest-floods-are-capped] given one device cookie, when one more guest than the limit is started in the window from different connections, then it is refused too-many; after the window it is allowed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-08T09:00:00Z");
    vi.setSystemTime(start);
    const h = harness({ config: testConfig({ testing: { captureOtp: true }, account: limits }) });
    let device = "";
    const startOne = async (at: number) => {
      const jar = makeJar();
      if (device !== "") jar.cookies.set(DEVICE_COOKIE, device);
      await h.passAge(jar);
      const reply = await h.startGuest(jar, { ip: `198.51.100.${String(at)}` });
      device = jar.cookies.get(DEVICE_COOKIE) ?? device;
      return reply;
    };
    expect((await startOne(1)).status).toBe(200);
    expect((await startOne(2)).status).toBe(200);
    const third = await startOne(3);
    expect(third.status).toBe(429);
    expect(await body(third)).toMatchObject({ code: "too-many" });
    vi.setSystemTime(start + limits.guestWindowHours * 3_600_000 - 1);
    expect((await startOne(4)).status).toBe(429);
    vi.setSystemTime(start + limits.guestWindowHours * 3_600_000);
    expect((await startOne(5)).status).toBe(200);
  });

  test("[account:guest-floods-are-capped] given one connection, when one more guest than the limit is started in the window from fresh devices, then it is refused too-many", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true }, account: limits }) });
    const results: number[] = [];
    for (let at = 0; at < limits.guestsPerConnection + 1; at += 1) {
      const jar = makeJar();
      await h.passAge(jar, {});
      results.push((await h.startGuest(jar, { ip: "198.51.100.99" })).status);
    }
    expect(results).toEqual([200, 200, 200, 429]);
    expect(h.tables.user).toHaveLength(limits.guestsPerConnection);
  });

  test("[account:guest-floods-are-capped] given one IPv6 /64, when one more guest than the limit is started in the window from different addresses in it and fresh devices, then it is refused too-many; the next /64 is still allowed", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true }, account: limits }) });
    const addresses = ["2001:db8:1:2::1", "2001:DB8:1:2:ffff:ffff:ffff:fffe", "2001:0db8:0001:0002:0:0:0:3", "2001:db8:1:2:8000::4", "2001:db8:1:3::1"];
    const results: number[] = [];
    for (const ip of addresses) {
      const jar = makeJar();
      await h.passAge(jar, {});
      results.push((await h.startGuest(jar, { ip })).status);
    }
    expect(results).toEqual([200, 200, 200, 429, 200]);
    expect(h.tables.user).toHaveLength(limits.guestsPerConnection + 1);
  });

  test("[account:guest-floods-are-capped] given addresses as Cloudflare passes them, when each is taken as a connection, then an IPv6 one is its /64 however it is written, and an IPv4 one, or one carried in IPv6, is itself", () => {
    expect(connectionOf("198.51.100.7")).toBe("198.51.100.7");
    expect(connectionOf("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(connectionOf("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64");
    expect(connectionOf("2001:0DB8:0001:0002:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::/64");
    expect(connectionOf("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(connectionOf("::1")).toBe("0:0:0:0::/64");
    expect(connectionOf("2001:db8:1:3::")).toBe("2001:db8:1:3::/64");
  });
});

describe("the guest start under the server's limits", () => {
  test("[server:per-account-rate-limits] [account:guest-floods-are-capped] given the guest start, then it counts as a command under its address's limit and is refused rate-limited over it; and a connection over account:guest-floods-are-capped's limit is refused too-many before the anonymous sign-in, with no account made", async () => {
    const config = testConfig({ testing: { captureOtp: true }, limits: { anonPer60s: 3 }, account: { guestsPerDevice: 5, guestsPerConnection: 1, guestWindowHours: 24 } });
    // The limits' own clock; the library's age pass and the guest counts read the machine's.
    let now = 0;
    const h = harness({ config, limits: memoryLimiters(config.limits, () => now) });
    // The age screen's answer and the guest start count together against the one address: 1, 2, then 3 and 4.
    const first = makeJar();
    expect((await h.passAge(first)).status).toBe(200);
    expect((await h.startGuest(first)).status).toBe(200);
    const second = makeJar();
    expect((await h.passAge(second)).status).toBe(200);
    const over = await h.startGuest(second);
    expect(over.status).toBe(429);
    expect(await body(over)).toMatchObject({ code: "rate-limited", retryAfter: 60 });
    expect(h.tables.user).toHaveLength(1);
    // A minute on, the address may ask again; the connection's guest limit refuses it before any account is made.
    now += 60_000;
    const flood = await h.startGuest(second);
    expect(flood.status).toBe(429);
    expect(await body(flood)).toMatchObject({ code: "too-many" });
    expect(h.tables.user).toHaveLength(1);
  });

  test("[server:per-account-rate-limits] [account:bot-check-on-guest-creation] given a browser that calls the library's anonymous sign-in route itself, then it is refused, whatever the limits, and no account is made", async () => {
    const h = harness();
    const reply = await h.call("/api/auth/sign-in/anonymous", { method: "POST", jar: makeJar(), json: {} });
    expect(reply.status).toBe(404);
    expect(h.tables.user).toEqual([]);
  });
});

describe("the last time a life was played", () => {
  test("[account:idle-guests-cleaned-by-hand] given a guest, when it starts its life and sends a command later, then its last play follows each", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-09T19:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const { jar, account } = await h.guest();
    expect((await h.deps.stores.account.get(account))?.lastPlayedAt).toBe(start);
    vi.setSystemTime(start + 60_000);
    await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.graduate" } });
    expect((await h.deps.stores.account.get(account))?.lastPlayedAt).toBe(start + 60_000);
    vi.setSystemTime(start + 120_000);
    const view = await (await h.call("/api/view", { jar })).json<ViewReply>();
    if (!view.ok) throw new Error(view.detail);
    await h.call("/api/command", { method: "POST", jar, json: { command: { type: "turn/end", slots: [], basedOn: view.view.v }, basedOn: view.view.v } });
    expect((await h.deps.stores.account.get(account))?.lastPlayedAt).toBe(start + 120_000);
  });

  test("[account:idle-guests-cleaned-by-hand] [server:server-plays-prologue-preset] given a guest with a new life from sixteen, when its preset is sent later, then its last play follows the preset request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-09T19:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const { jar, account } = await h.guest();
    await h.call("/api/character", { method: "POST", jar, json: { scenario: "scenario.prologue" } });
    vi.setSystemTime(start + 60_000);
    const played = await (await h.call("/api/prologue/preset", { method: "POST", jar, json: { archetype: "developer", age: 0, home: "family-house", basedOn: 0 } })).json<{ ok: boolean }>();
    expect(played.ok).toBe(true);
    expect((await h.deps.stores.account.get(account))?.lastPlayedAt).toBe(start + 60_000);
  });
});
