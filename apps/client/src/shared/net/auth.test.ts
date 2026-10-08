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
