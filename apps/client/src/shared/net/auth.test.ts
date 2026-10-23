import { afterEach, describe, expect, test } from "vitest";

import { fakePhone, type Phone } from "../testing/passkeys";
import { BASE, fakeServer, type FakeServer } from "../testing/server";
import { say } from "../words/text";
import { betterAuthApi, CAPTCHA_HEADER } from "./auth";

const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function account() {
  const server = fakeServer();
  return { server, api: betterAuthApi({ baseUrl: BASE, fetch: server.fetch }) };
}

describe("the age screen's routes, as the server built them", () => {
  test("[account:age-screen-refuses-minors] [account:bot-check-on-guest-creation] given a date, when the age is declared, then POST /api/age carries the date as dateOfBirth and no bot token, which goes with the guest start, and a pass opens it", async () => {
    const { server, api } = account();
    server.answer("POST /api/age", { body: { ok: true } });
    expect(await api.declareAge("2000-02-29")).toBe("passed");
    const sent = server.sent.find((request) => request.path === "/api/age");
    expect(sent?.body).toEqual({ dateOfBirth: "2000-02-29" });
    expect(sent?.headers[CAPTCHA_HEADER]).toBeUndefined();
    // engine:browser-authority-for-dev-only: every call goes through the one request function, same-origin.
    expect(sent?.credentials).toBe("same-origin");
  });

  test("[account:age-screen-refuses-minors] given the server's under-age refusal, then the standing is refused; a date it does not believe and a failed bot check are said, not refused", async () => {
    const { server, api } = account();
    server.answer(
      "POST /api/age",
      { status: 403, body: { ok: false, code: "under-age", detail: "This browser cannot sign up." } },
      { status: 400, body: { ok: false, code: "bad-date", detail: "That is not a date of birth." } },
      { status: 403, body: { ok: false, code: "bot-check", detail: "invalid-input-response" } },
    );
    expect(await api.declareAge("2010-01-01")).toBe("refused");
    expect(await api.declareAge("1800-01-01")).toBe("bad-date");
    expect(await api.declareAge("2000-01-01")).toBe("bot-check");
  });

  test("[account:age-screen-refuses-minors] given a browser the server refused before, when it asks where it stands, then GET /api/age says refused and the screen refuses without asking again", async () => {
    const { server, api } = account();
    server.answer("GET /api/age", { body: { refused: true } });
    expect(await api.ageStatus()).toBe("refused");
    expect(server.sent.map((request) => `${request.method} ${request.path}`)).toEqual(["GET /api/age"]);
    // engine:browser-authority-for-dev-only: every call goes through the one request function, same-origin.
    expect(server.sent[0]?.credentials).toBe("same-origin");
  });

  test("[server:signups-off-shows-full] given sign-ups switched off, when the browser asks where it stands or declares an age, then the 503 is the full screen with the server's wait", async () => {
    const { server, api } = account();
    const off = { status: 503, body: { ok: false, code: "switched-off", detail: "Sign-ups are closed for now.", retryAfter: 30 }, headers: { "Retry-After": "30" } };
    server.answer("GET /api/age", off);
    server.answer("POST /api/age", off);
    expect(await api.ageStatus()).toEqual({ full: true, retryAfter: 30 });
    expect(await api.declareAge("2000-01-01")).toEqual({ full: true, retryAfter: 30 });
  });

  test("[account:age-screen-refuses-minors] given a browser holding a pass, when it asks where it stands, then it is passed; a pass beside a refusal is refused, and a reply with no pass named is still to ask", async () => {
    const { server, api } = account();
    server.answer("GET /api/age", { body: { refused: false, passed: true } }, { body: { refused: true, passed: true } }, { body: { refused: false } });
    expect(await api.ageStatus()).toBe("passed");
    expect(await api.ageStatus()).toBe("refused");
    expect(await api.ageStatus()).toBe("unasked");
  });

  test("[server:signups-off-shows-full] given sign-ups open and a browser never refused, when it asks where it stands, then the age screen is still to ask", async () => {
    const { server, api } = account();
    server.answer("GET /api/age", { body: { refused: false } });
    expect(await api.ageStatus()).toBe("unasked");
  });
});

describe("deleting the account, as the server built it", () => {
  test("[account:player-deletes-account] given a fresh session, when the account is deleted, then DELETE /api/account goes with an empty body and the session cookie, and the auth library's own route is never called", async () => {
    const { server, api } = account();
    server.answer("DELETE /api/account", { body: { ok: true, dueAt: 1 } });
    expect(await api.deleteAccount(null)).toEqual({ ok: true });
    expect(server.sent.map((request) => `${request.method} ${request.path}`)).toEqual(["DELETE /api/account"]);
    expect(server.sent[0]?.body).toEqual({});
    // engine:browser-authority-for-dev-only: the page and the API are one origin, so the session cookie goes same-origin.
    expect(server.sent[0]?.credentials).toBe("same-origin");
  });

  test("[account:player-deletes-account] given a session that is not fresh, then the server's not-fresh is told; with the emailed code the deletion goes with { code } and succeeds", async () => {
    const { server, api } = account();
    server.answer("DELETE /api/account", { status: 403, body: { ok: false, code: "not-fresh", detail: "Sign in again or send a code to your email." } }, { body: { ok: true, dueAt: 1 } });
    expect(await api.deleteAccount(null)).toEqual({ ok: false, why: "not-fresh" });
    expect(await api.deleteAccount("654321")).toEqual({ ok: true });
    expect(server.sent.map((request) => request.body)).toEqual([{}, { code: "654321" }]);
  });

  test("[account:player-deletes-account] given a code the server does not take, then bad-code is told; a rate limit, a signed-out session and no server are said plainly", async () => {
    const { server, api } = account();
    server.answer(
      "DELETE /api/account",
      { status: 403, body: { ok: false, code: "bad-code", detail: "That code did not work." } },
      { status: 429, body: { ok: false, code: "rate-limited", detail: "Too many requests.", retryAfter: 5 } },
      { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in first." } },
    );
    expect(await api.deleteAccount("000000")).toEqual({ ok: false, why: "bad-code" });
    expect(await api.deleteAccount("000000")).toEqual({ ok: false, why: "too-many" });
    expect(await api.deleteAccount(null)).toEqual({ ok: false, why: "refused" });
    const offline = betterAuthApi({ baseUrl: BASE, fetch: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(await offline.deleteAccount(null)).toEqual({ ok: false, why: "unreachable" });
  });
});

describe("the ways in and the settings, as the server refuses them", () => {
  test("[account:passkey-needs-signed-in-session] given an admin on a code session, when a new passkey is asked for, then the server's 403 is told as passkey-first, never a plain refusal", async () => {
    const { server, api } = account();
    server.answer("GET /api/auth/passkey/generate-register-options", { status: 403, body: { message: "A new passkey on an admin account is added only from a session opened with a passkey; sign in with yours first." } });
    expect(await api.addPasskey()).toEqual({ ok: false, why: "passkey-first" });
    expect(server.sent.map((request) => `${request.method} ${request.path}`)).toEqual(["GET /api/auth/passkey/generate-register-options"]);
  });

  test("[account:passkey-needs-signed-in-session] given any other refusal of a new passkey, then it stays a plain refusal", async () => {
    const { server, api } = account();
    server.answer("GET /api/auth/passkey/generate-register-options", { status: 401, body: { message: "Unauthorized" } });
    expect(await api.addPasskey()).toEqual({ ok: false, why: "refused" });
  });

  test("[account:start-screen-over-live-city] given a way back in with no life behind it, when the server refuses to make an account there, then the refusal is told as no-life", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/sign-in/email-otp", { status: 403, body: { code: "no-account", message: "No life is saved with this sign-in. Start a new one." } });
    expect(await api.signInWithCode("new@example.test", "123456", null)).toEqual({ ok: false, why: "no-life" });
  });
});

const VIEW = { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, admin: false, state: "guest", username: "ada_lagos", renameFrom: 0, ways: { google: null, email: null, passkeys: 0 } };

describe("the guest start and the username, as the server built them", () => {
  test("[account:username-typed-and-checked] given the server's answers, when the box asks whether a name is free, then GET /api/username/available carries the name in its query and free, taken and the name's own problem come back; a limit or no answer is null", async () => {
    const { server, api } = account();
    server.answer(
      "GET /api/username/available",
      { body: { ok: true, free: true } },
      { body: { ok: true, free: false } },
      { status: 400, body: { ok: false, code: "not-legal", detail: "no", name: "reserved" } },
      { status: 400, body: { ok: false, code: "not-legal", detail: "no", name: "blocked" } },
      { status: 400, body: { ok: false, code: "not-legal", detail: "no", name: "format" } },
      { status: 429, body: { ok: false, code: "rate-limited", detail: "Too many requests.", retryAfter: 60 } },
    );
    const heard = [];
    for (const name of ["Ada_Lagos", "ada_lagos", "staff_ada", "big_ashawo", "ab", "ada_again"]) heard.push(await api.usernameFree(name));
    expect(heard).toEqual(["free", "taken", "reserved", "blocked", "format", null]);
    expect(server.sent[0]).toMatchObject({ method: "GET", path: "/api/username/available", search: "?name=Ada_Lagos", credentials: "same-origin" });
    const lost = betterAuthApi({ baseUrl: BASE, fetch: () => Promise.reject(new TypeError("Load failed")) });
    expect(await lost.usernameFree("ada_lagos")).toBeNull();
  });

  test("[account:guest-and-secured-states] [account:bot-check-on-guest-creation] given a username and the bot check's token, when a guest life is started, then POST /api/guest carries the username and the token in its header", async () => {
    const { server, api } = account();
    server.answer("POST /api/guest", { body: { ok: true, account: VIEW } });
    expect(await api.startGuest("ada_lagos", TOKEN)).toEqual({ ok: true });
    const sent = server.sent.find((request) => request.path === "/api/guest");
    expect(sent?.body).toEqual({ username: "ada_lagos" });
    expect(sent?.headers[CAPTCHA_HEADER]).toBe(TOKEN);
    // engine:browser-authority-for-dev-only: every call goes through the one request function, same-origin.
    expect(sent?.credentials).toBe("same-origin");
  });

  test("[account:username-and-unconfirmed-email] [account:guest-floods-are-capped] given each refusal of the guest start, then the screen hears why: the username's problem, the bot check, the limits, a run-out age answer, the switch", async () => {
    const { server, api } = account();
    const refusal = (status: number, code: string, name?: string) => ({ status, body: { ok: false, code, detail: "no", ...(name === undefined ? {} : { name }) } });
    server.answer(
      "POST /api/guest",
      refusal(409, "not-legal", "taken"),
      refusal(400, "not-legal", "reserved"),
      refusal(403, "bot-check"),
      refusal(429, "too-many"),
      refusal(403, "expired"),
      refusal(503, "switched-off"),
    );
    const heard = [];
    for (let at = 0; at < 6; at += 1) heard.push(await api.startGuest("ada_lagos", null));
    expect(heard.map((answer) => (answer.ok ? "ok" : answer.why))).toEqual(["taken", "reserved", "bot-check", "too-many", "expired", "full"]);
  });

  test("[account:username-and-unconfirmed-email] given a new username, when it is changed, then PUT /api/account/username carries it and a refusal says why", async () => {
    const { server, api } = account();
    server.answer("PUT /api/account/username", { body: { ok: true, account: VIEW } }, { status: 403, body: { ok: false, code: "not-legal", detail: "later", name: "wait" } });
    expect(await api.rename("Ada_Ibadan")).toEqual({ ok: true });
    expect(server.sent[0]?.body).toEqual({ username: "Ada_Ibadan" });
    expect(await api.rename("Ada_Kano")).toEqual({ ok: false, why: "wait" });
  });

  test("[account:guest-and-secured-states] given the account changes, when it is read again, then GET /api/account is asked each time and its state comes back", async () => {
    const { server, api } = account();
    server.answer("GET /api/account", { body: { ok: true, account: VIEW } }, { body: { ok: true, account: { ...VIEW, state: "secured" } } });
    expect((await api.view())?.state).toBe("guest");
    expect((await api.view())?.state).toBe("secured");
  });

  test("[account:guest-secures-the-life] given Google sent the page back with the server's method-taken, when it is read, then it is the taken failure, once, and the address is left clean", () => {
    const { api } = account();
    history.replaceState(null, "", "/?error=method-taken&error_description=x");
    expect(api.returnedFromGoogle()).toBe("taken");
    expect(location.search).toBe("");
    expect(api.returnedFromGoogle()).toBeNull();
    history.replaceState(null, "", "/?error=no-account");
    expect(api.returnedFromGoogle()).toBe("no-life");
  });
});

describe("the trip to Google to confirm a deletion (account:player-deletes-account)", () => {
  test("[account:player-deletes-account] given a trip to Google to confirm a deletion, when it leaves, then it comes back marked as that trip, and the page reads it once as the deletion's", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/sign-in/social", { body: { url: "https://accounts.google.test/o", redirect: false } });
    expect(await api.signInWithGoogle(null, "delete")).toEqual({ ok: true });
    const body = server.sent.find((request) => request.path === "/api/auth/sign-in/social")?.body as { callbackURL: string };
    history.replaceState(null, "", new URL(body.callbackURL).search);
    expect(api.returnedFromGoogle()).toBe("delete");
    expect(location.search).toBe("");
    expect(api.returnedFromGoogle()).toBeNull();
  });
});

describe("the trip to Google and back (account:guest-secures-the-life)", () => {
  test("[account:guest-secures-the-life] given a trip to keep a guest's life or to sign back in, when it leaves, then the library is asked to come back to the page marked with that trip, and a refusal to the bare page", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/sign-in/social", { body: { url: "https://accounts.google.test/o", redirect: false } }, { body: { url: "https://accounts.google.test/o", redirect: false } });
    expect(await api.signInWithGoogle(null, "keep")).toEqual({ ok: true });
    expect(await api.signInWithGoogle(null)).toEqual({ ok: true });
    const asked = server.sent.filter((request) => request.path === "/api/auth/sign-in/social").map((request) => request.body as { callbackURL: string; errorCallbackURL: string });
    expect(asked.map((body) => new URL(body.callbackURL).search)).toEqual(["?google=kept", "?google=in"]);
    expect(asked.map((body) => new URL(body.errorCallbackURL).search)).toEqual(["", ""]);
  });

  test("[account:guest-secures-the-life] given Google sent the page back having kept the life, or signed back in, or with nothing, when it is read, then it tells each apart, once, and the address is left clean", () => {
    const { api } = account();
    history.replaceState(null, "", "/?google=kept");
    expect(api.returnedFromGoogle()).toBe("kept");
    expect(location.search).toBe("");
    expect(api.returnedFromGoogle()).toBeNull();
    history.replaceState(null, "", "/?google=in#map");
    expect(api.returnedFromGoogle()).toBe("signed-in");
    expect(`${location.search}${location.hash}`).toBe("#map");
    history.replaceState(null, "", "/?google=other");
    expect(api.returnedFromGoogle()).toBeNull();
    expect(location.search).toBe("");
  });

  test("[account:guest-secures-the-life] given the library would not join Google to an address kept by a code, when the page comes back with account_not_linked, then it is the not-linked failure, never the library's code", () => {
    const { api } = account();
    history.replaceState(null, "", "/?error=account_not_linked");
    expect(api.returnedFromGoogle()).toBe("not-linked");
    expect(location.search).toBe("");
  });

  test("[account:guest-secures-the-life] given Google sent the page back with access_denied, then it is a cancel; state_mismatch, please_restart_the_process and an error the game does not know are a trip that did not finish", () => {
    const { api } = account();
    history.replaceState(null, "", "/?error=access_denied");
    expect(api.returnedFromGoogle()).toBe("cancelled");
    expect(location.search).toBe("");
    for (const error of ["state_mismatch", "please_restart_the_process", "something_new"]) {
      history.replaceState(null, "", `/?error=${error}&error_description=x`);
      expect(api.returnedFromGoogle()).toBe("google");
      expect(location.search).toBe("");
    }
    expect(say("ui.account.fail.cancelled")).toBe("Nothing happened. Try again when you are ready.");
    expect(say("ui.account.fail.google")).toBe("Google sign-in did not finish. Try again, or use a code by email.");
  });
});

const OWN = "b3duLWtleQ";
const OTHERS = "b3RoZXJzLWtleQ";
/** The library's options for a sign-in from a signed-in session: the account's own passkeys allowed, when it holds any. */
const SIGN_IN_OPTIONS = { challenge: "Y2hhbGxlbmdl", rpId: "play.test", allowCredentials: [{ id: OWN, type: "public-key" }], userVerification: "preferred", timeout: 60000 };
const OWN_ROW = { id: "row-own", credentialID: OWN, userId: "account-1", aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", createdAt: "2026-10-01T09:00:00.000Z" };

let phone: Phone | null = null;
afterEach(() => {
  phone?.restore();
  phone = null;
});

const routes = (server: FakeServer) => server.sent.map((request) => `${request.method} ${request.path}`);

describe("confirming with a passkey (account:player-deletes-account, account:passkey-added-in-place)", () => {
  test("[account:player-deletes-account] given a phone that answers with a passkey of another account, when the deletion is confirmed with a passkey, then the answer never reaches the server, no session is opened for that account, and other-account is told", async () => {
    const { server, api } = account();
    phone = fakePhone({ signsInWith: OTHERS });
    server.answer("GET /api/auth/passkey/list-user-passkeys", { body: [OWN_ROW] });
    server.answer("GET /api/auth/passkey/generate-authenticate-options", { body: { ...SIGN_IN_OPTIONS, allowCredentials: undefined } });
    server.answer("POST /api/auth/passkey/verify-authentication", { body: { session: { id: "s-other" }, user: { id: "account-2" } } });
    expect(await api.confirmWithPasskey()).toEqual({ ok: false, why: "other-account" });
    expect(routes(server)).toEqual(["GET /api/auth/passkey/list-user-passkeys", "GET /api/auth/passkey/generate-authenticate-options"]);
  });

  test("[account:player-deletes-account] given a phone that answers with one of the account's own passkeys, then it goes to the server and the session is fresh", async () => {
    const { server, api } = account();
    phone = fakePhone({ signsInWith: OWN });
    server.answer("GET /api/auth/passkey/list-user-passkeys", { body: [OWN_ROW] });
    server.answer("GET /api/auth/passkey/generate-authenticate-options", { body: SIGN_IN_OPTIONS });
    server.answer("POST /api/auth/passkey/verify-authentication", { body: { session: { id: "s-1" }, user: { id: "account-1" } } });
    expect(await api.confirmWithPasskey()).toEqual({ ok: true });
    expect(phone.asked).toEqual([{ allow: [OWN] }]);
    expect(server.sent.find((request) => request.path === "/api/auth/passkey/verify-authentication")?.body).toMatchObject({ response: { id: OWN } });
  });

  test("[account:player-deletes-account] given an account that holds no passkey, then no passkey is asked for at all", async () => {
    const { server, api } = account();
    phone = fakePhone();
    server.answer("GET /api/auth/passkey/list-user-passkeys", { body: [] });
    expect(await api.confirmWithPasskey()).toEqual({ ok: false, why: "refused" });
    expect(routes(server)).toEqual(["GET /api/auth/passkey/list-user-passkeys"]);
    expect(phone.asked).toEqual([]);
  });
});

describe("the passkeys of a kept life (account:passkeys-listed-and-removed, account:passkey-added-in-place)", () => {
  test("[account:passkey-added-in-place] given a new passkey, then no name is sent with it, so nothing is stored for the name beyond what the library takes from the account", async () => {
    const { server, api } = account();
    phone = fakePhone({ createFails: "NotAllowedError" });
    server.answer("GET /api/auth/passkey/generate-register-options", { body: { challenge: "Y2hhbGxlbmdl", rp: { id: "play.test", name: "Japacity" }, user: { id: "dXNlcg", name: "ada@example.com", displayName: "ada@example.com" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }] } });
    await api.addPasskey();
    const asked = server.sent.find((request) => request.path === "/api/auth/passkey/generate-register-options");
    expect(asked?.search).toBe("");
  });

  test("[account:passkey-added-in-place] given a session older than the fresh age, when a passkey is added, then the library's freshness refusal is told as not-fresh", async () => {
    const { server, api } = account();
    server.answer("GET /api/auth/passkey/generate-register-options", { status: 403, body: { code: "SESSION_NOT_FRESH", message: "Session is not fresh" } });
    expect(await api.addPasskey()).toEqual({ ok: false, why: "not-fresh" });
  });

  test("[account:passkeys-listed-and-removed] given the account's passkeys, then each comes by its provider's name from its AAGUID, none where the authenticator gives none, with the day it was added, oldest first", async () => {
    const { server, api } = account();
    server.answer("GET /api/auth/passkey/list-user-passkeys", {
      body: [
        { ...OWN_ROW, id: "row-2", aaguid: "00000000-0000-0000-0000-000000000000", createdAt: "2026-10-05T09:00:00.000Z" },
        OWN_ROW,
        { ...OWN_ROW, id: "row-3", aaguid: null, createdAt: "2026-10-09T09:00:00.000Z" },
      ],
    });
    expect(await api.passkeys()).toEqual([
      { id: "row-own", provider: "Google Password Manager", addedAt: Date.parse("2026-10-01T09:00:00.000Z") },
      { id: "row-2", provider: null, addedAt: Date.parse("2026-10-05T09:00:00.000Z") },
      { id: "row-3", provider: null, addedAt: Date.parse("2026-10-09T09:00:00.000Z") },
    ]);
    server.answer("GET /api/auth/passkey/list-user-passkeys", { status: 401, body: { message: "Unauthorized" } });
    expect(await api.passkeys()).toBeNull();
  });

  test("[account:passkeys-listed-and-removed] given a passkey removed, then the library's delete route gets its id, and whether this phone's session lived through it is read back", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/passkey/delete-passkey", { body: { status: true } });
    server.answer("GET /api/account", { body: { ok: true, account: { ...VIEW, state: "secured" } } }, { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } });
    expect(await api.removePasskey("row-own")).toEqual({ ok: true, signedIn: true });
    expect(server.sent.find((request) => request.path === "/api/auth/passkey/delete-passkey")?.body).toEqual({ id: "row-own" });
    expect(await api.removePasskey("row-own")).toEqual({ ok: true, signedIn: false });
  });

  test("[account:passkey-needs-signed-in-session] given an admin on a session that has not shown a passkey, when a passkey is removed, then the server's 403 is told as passkey-first-remove, never a plain refusal, and the account is not read again", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/passkey/delete-passkey", { status: 403, body: { message: "A passkey or a linked sign-in on an admin account is removed only from a session that has shown a passkey; use yours first." } });
    expect(await api.removePasskey("row-own")).toEqual({ ok: false, why: "passkey-first-remove" });
    expect(server.sent.map((request) => `${request.method} ${request.path}`)).toEqual(["POST /api/auth/passkey/delete-passkey"]);
  });

  test("[account:passkey-needs-signed-in-session] given any other refusal of a removal, then it stays a plain refusal", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/passkey/delete-passkey", { status: 401, body: { message: "Unauthorized" } });
    expect(await api.removePasskey("row-own")).toEqual({ ok: false, why: "refused" });
  });
});

describe("where a passkey can be made, and its errors (account:passkey-offered-where-it-works, account:passkey-errors-told-apart)", () => {
  test("[account:passkey-offered-where-it-works] given what the browser says it can do, then a passkey works with its own authenticator or a phone nearby, and not otherwise; without the capabilities call, its own authenticator decides", async () => {
    const { api } = account();
    const cases: [Record<string, boolean> | null, boolean, boolean][] = [
      [{ passkeyPlatformAuthenticator: true, hybridTransport: false }, false, true],
      [{ passkeyPlatformAuthenticator: false, hybridTransport: true }, false, true],
      [{ passkeyPlatformAuthenticator: false, hybridTransport: false }, true, false],
      [null, true, true],
      [null, false, false],
    ];
    for (const [capabilities, platform, works] of cases) {
      phone = fakePhone({ capabilities, platform });
      expect(await api.passkeysWork()).toBe(works);
      phone.restore();
      phone = null;
    }
    expect(await api.passkeysWork()).toBe(false);
  });

  test("[account:passkey-errors-told-apart] given the phone's own refusals, then a cancel is cancelled and a passkey already on this phone is told apart, never a plain refusal", async () => {
    const { server, api } = account();
    const options = { challenge: "Y2hhbGxlbmdl", rp: { id: "play.test", name: "Japacity" }, user: { id: "dXNlcg", name: "ada@example.com", displayName: "ada@example.com" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }] };
    server.answer("GET /api/auth/passkey/generate-register-options", { body: options });
    phone = fakePhone({ createFails: "NotAllowedError" });
    expect(await api.addPasskey()).toEqual({ ok: false, why: "cancelled" });
    phone.restore();
    phone = fakePhone({ createFails: "InvalidStateError" });
    expect(await api.addPasskey()).toEqual({ ok: false, why: "already-here" });
    phone.restore();
    phone = fakePhone({ signInFails: "NotAllowedError" });
    server.answer("GET /api/auth/passkey/generate-authenticate-options", { body: SIGN_IN_OPTIONS });
    expect(await api.signInWithPasskey()).toEqual({ ok: false, why: "cancelled" });
  });

  test("[account:passkey-errors-told-apart] given a passkey the server no longer holds, when the phone signs in with it, then passkey-gone is told and the phone is told to stop offering it", async () => {
    const { server, api } = account();
    phone = fakePhone({ signsInWith: OWN });
    server.answer("GET /api/auth/passkey/generate-authenticate-options", { body: { ...SIGN_IN_OPTIONS, allowCredentials: undefined } });
    server.answer("POST /api/auth/passkey/verify-authentication", { status: 401, body: { code: "PASSKEY_NOT_FOUND", message: "Passkey not found" } });
    expect(await api.signInWithPasskey()).toEqual({ ok: false, why: "passkey-gone" });
    await Promise.resolve();
    expect(phone.signalled).toEqual([{ rpId: location.hostname, credentialId: OWN }]);
  });
});

describe("signing out (account:sign-out-ends-the-session)", () => {
  test("[account:sign-out-ends-the-session] given a sign-out the server answers, then it is done; one that never reaches it is told as sign-out, never as done", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/sign-out", { body: { success: true } });
    expect(await api.signOut()).toEqual({ ok: true });
    const offline = betterAuthApi({ baseUrl: BASE, fetch: () => Promise.reject(new TypeError("Failed to fetch")) });
    expect(await offline.signOut()).toEqual({ ok: false, why: "sign-out" });
  });

  test("[account:sign-out-ends-the-session] given sign out on every phone, then every session of the account is ended on the server first, then this browser's cookie; a failure to end them sends nothing more and is told", async () => {
    const { server, api } = account();
    server.answer("POST /api/auth/revoke-sessions", { body: { status: true } }, { status: 500, body: { message: "Internal Server Error" } });
    server.answer("POST /api/auth/sign-out", { body: { success: true } });
    expect(await api.signOutEverywhere()).toEqual({ ok: true });
    expect(routes(server)).toEqual(["POST /api/auth/revoke-sessions", "POST /api/auth/sign-out"]);
    expect(await api.signOutEverywhere()).toEqual({ ok: false, why: "sign-out" });
    expect(routes(server)).toEqual(["POST /api/auth/revoke-sessions", "POST /api/auth/sign-out", "POST /api/auth/revoke-sessions"]);
  });
});
