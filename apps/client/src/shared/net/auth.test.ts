import { describe, expect, test } from "vitest";

import { BASE, fakeServer } from "../testing/server";
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
});
