import { describe, expect, test } from "vitest";

import { BASE, fakeServer } from "../testing/server";
import { betterAuthApi, CAPTCHA_HEADER } from "./auth";
import { REFUSED_COOKIE } from "./contract";

const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function account(cookie = "") {
  const server = fakeServer();
  return { server, api: betterAuthApi({ baseUrl: BASE, fetch: server.fetch, cookie: () => cookie }) };
}

describe("the age screen's routes, as the server built them", () => {
  test("[R-ACCOUNT-012] [R-ACCOUNT-013] given a date and the bot check's token, when the age is declared, then POST /api/age carries the date as dateOfBirth and the token in its header, and a pass opens the ways in", async () => {
    const { server, api } = account();
    server.answer("POST /api/age", { body: { ok: true } });
    expect(await api.declareAge("2000-02-29", TOKEN)).toBe("passed");
    const sent = server.sent.find((request) => request.path === "/api/age");
    expect(sent?.body).toEqual({ dateOfBirth: "2000-02-29" });
    expect(sent?.headers[CAPTCHA_HEADER]).toBe(TOKEN);
    expect(sent?.credentials).toBe("include");
  });

  test("[R-ACCOUNT-012] given the server's under-age refusal, then the standing is refused; a date it does not believe and a failed bot check are said, not refused", async () => {
    const { server, api } = account();
    server.answer(
      "POST /api/age",
      { status: 403, body: { ok: false, code: "under-age", detail: "This browser cannot sign up." } },
      { status: 400, body: { ok: false, code: "bad-date", detail: "That is not a date of birth." } },
      { status: 403, body: { ok: false, code: "bot-check", detail: "invalid-input-response" } },
    );
    expect(await api.declareAge("2010-01-01", TOKEN)).toBe("refused");
    expect(await api.declareAge("1800-01-01", TOKEN)).toBe("bad-date");
    expect(await api.declareAge("2000-01-01", null)).toBe("bot-check");
  });

  test("[R-ACCOUNT-012] given the server's refusal cookie on the page, then the screen refuses without asking the server", async () => {
    const { server, api } = account(`other=1; ${REFUSED_COOKIE}=1`);
    expect(await api.ageStatus()).toBe("refused");
    expect(server.sent).toEqual([]);
  });

  test("[R-ACCOUNT-011] given a region that is not open, then the age screen's answer is region-closed", async () => {
    const { server, api } = account();
    server.answer("POST /api/age", { status: 403, body: { ok: false, code: "region-closed", detail: "Sign-up is not open in this region." } });
    expect(await api.declareAge("2000-01-01", TOKEN)).toBe("region-closed");
  });

  test("[R-SERVER-032] given sign-ups switched off, when the browser asks where it stands or declares an age, then the 503 is the full screen with the server's wait", async () => {
    const { server, api } = account();
    const off = { status: 503, body: { ok: false, code: "switched-off", detail: "Sign-ups are closed for now.", retryAfter: 30 }, headers: { "Retry-After": "30" } };
    server.answer("GET /api/age", off);
    server.answer("POST /api/age", off);
    expect(await api.ageStatus()).toEqual({ full: true, retryAfter: 30 });
    expect(await api.declareAge("2000-01-01", TOKEN)).toEqual({ full: true, retryAfter: 30 });
  });

  test("[R-SERVER-032] given sign-ups open, when the browser asks where it stands, then the server's not-found is the age screen still to ask", async () => {
    const { api } = account();
    expect(await api.ageStatus()).toBe("unasked");
  });
});

describe("deleting the account, as the server built it", () => {
  test("[R-ACCOUNT-016] given a fresh session, when the account is deleted, then DELETE /api/account goes with an empty body and the session cookie, and the auth library's own route is never called", async () => {
    const { server, api } = account();
    server.answer("DELETE /api/account", { body: { ok: true, dueAt: 1 } });
    expect(await api.deleteAccount(null)).toEqual({ ok: true });
    expect(server.sent.map((request) => `${request.method} ${request.path}`)).toEqual(["DELETE /api/account"]);
    expect(server.sent[0]?.body).toEqual({});
    expect(server.sent[0]?.credentials).toBe("include");
  });

  test("[R-ACCOUNT-016] given a session that is not fresh, then the server's not-fresh is told; with the emailed code the deletion goes with { code } and succeeds", async () => {
    const { server, api } = account();
    server.answer("DELETE /api/account", { status: 403, body: { ok: false, code: "not-fresh", detail: "Sign in again or send a code to your email." } }, { body: { ok: true, dueAt: 1 } });
    expect(await api.deleteAccount(null)).toEqual({ ok: false, why: "not-fresh" });
    expect(await api.deleteAccount("654321")).toEqual({ ok: true });
    expect(server.sent.map((request) => request.body)).toEqual([{}, { code: "654321" }]);
  });

  test("[R-ACCOUNT-016] given a code the server does not take, then bad-code is told; a rate limit, a signed-out session and no server are said plainly", async () => {
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
