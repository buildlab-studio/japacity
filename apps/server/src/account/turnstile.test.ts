import { describe, expect, test } from "vitest";

import { checkTurnstile, TOKEN_MAX_LENGTH, TURNSTILE_ACTION, TURNSTILE_TEST } from "./turnstile";

/** Siteverify answered as Cloudflare answers a test secret: a pass on example.com, marked as made with a testing key. */
function siteverify(answer: Record<string, unknown>): typeof fetch {
  return () => Promise.resolve(Response.json(answer));
}

const TESTING_PASS = { success: true, "error-codes": [], hostname: "example.com", metadata: { result_with_testing_key: true } };
const keys = (answer: Record<string, unknown>) => ({ secretKey: TURNSTILE_TEST.passSecret, fetch: siteverify(answer) });

describe("the bot check's host", () => {
  test("[R-ACCOUNT-013] given a pass made with a testing key, when SITE_URL's host is localhost or 127.0.0.1, then it is accepted", async () => {
    for (const host of ["localhost", "127.0.0.1"]) {
      expect(await checkTurnstile(keys(TESTING_PASS), TURNSTILE_TEST.dummyToken, null, host)).toEqual({ ok: true });
    }
  });

  test("[R-ACCOUNT-013] given a pass made with a testing key, when SITE_URL's host is any other, then it is refused as a host mismatch", async () => {
    for (const host of ["japacity.app", "staging.japacity.app", "localhost.japacity.app", "127.0.0.1.example", "example.org"]) {
      expect(await checkTurnstile(keys(TESTING_PASS), TURNSTILE_TEST.dummyToken, null, host)).toEqual({ ok: false, reason: "hostname-mismatch" });
    }
  });

  test("[R-ACCOUNT-013] given a pass on another host with no testing mark, when SITE_URL is local, then it is refused as before", async () => {
    for (const metadata of [undefined, { result_with_testing_key: false }, { result_with_testing_key: "true" }]) {
      const answer = { success: true, hostname: "elsewhere.example", ...(metadata === undefined ? {} : { metadata }) };
      expect(await checkTurnstile(keys(answer), TURNSTILE_TEST.dummyToken, null, "localhost")).toEqual({ ok: false, reason: "hostname-mismatch" });
    }
  });

  test("[R-ACCOUNT-013] given a pass on SITE_URL's own host for the guest start's action, when it is checked, then it is accepted as before", async () => {
    // A pass that is not a test key's must also name the action the widget was rendered with.
    expect(await checkTurnstile(keys({ success: true, hostname: "japacity.app", action: "guest" }), TURNSTILE_TEST.dummyToken, null, "japacity.app")).toEqual({ ok: true });
  });
});

describe("the bot check's action, size and reply", () => {
  test("[R-ACCOUNT-013] given the widget's action, then it is the guest start's: guest", () => {
    expect(TURNSTILE_ACTION).toBe("guest");
  });

  test("[R-ACCOUNT-013] given a pass on SITE_URL's own host with another action or none, when it is checked, then it is refused as an action mismatch", async () => {
    for (const action of [undefined, "", "login", "Guest", "guest ", null, 1]) {
      const answer = { success: true, hostname: "japacity.app", ...(action === undefined ? {} : { action }) };
      expect({ action, check: await checkTurnstile(keys(answer), TURNSTILE_TEST.dummyToken, null, "japacity.app") }).toEqual({ action, check: { ok: false, reason: "action-mismatch" } });
    }
  });

  test("[R-ACCOUNT-013] given a pass for the guest action on another host, when it is checked, then the host is refused first", async () => {
    expect(await checkTurnstile(keys({ success: true, hostname: "elsewhere.example", action: "guest" }), TURNSTILE_TEST.dummyToken, null, "japacity.app")).toEqual({ ok: false, reason: "hostname-mismatch" });
  });

  test("[R-ACCOUNT-013] given the very answer siteverify gives the published always-pass test secret (example.com, marked, no action), when SITE_URL is the local stack's, then it passes with no action asked; on the game's host it is still refused", async () => {
    // As siteverify answered the always-pass test secret and the dummy token on 11 Oct 2026.
    const answer = { challenge_ts: "2026-10-11T12:21:51.837Z", "error-codes": [], hostname: "example.com", metadata: { result_with_testing_key: true }, success: true };
    for (const host of ["localhost", "127.0.0.1"]) expect(await checkTurnstile(keys(answer), TURNSTILE_TEST.dummyToken, null, host)).toEqual({ ok: true });
    expect(await checkTurnstile(keys(answer), TURNSTILE_TEST.dummyToken, null, "japacity.app")).toEqual({ ok: false, reason: "hostname-mismatch" });
  });

  test("[R-ACCOUNT-013] given a token longer than 2048 characters, when it is checked, then it is refused before siteverify is called; one of 2048 is sent", async () => {
    let calls = 0;
    const counting: typeof fetch = () => {
      calls += 1;
      return Promise.resolve(Response.json({ success: true, hostname: "japacity.app", action: "guest" }));
    };
    expect(TOKEN_MAX_LENGTH).toBe(2048);
    const check = (token: string) => checkTurnstile({ secretKey: TURNSTILE_TEST.passSecret, fetch: counting }, token, null, "japacity.app");
    expect(await check("x".repeat(2049))).toEqual({ ok: false, reason: "token-too-long" });
    expect(calls).toBe(0);
    expect(await check("x".repeat(2048))).toEqual({ ok: true });
    expect(calls).toBe(1);
  });

  test("[R-ACCOUNT-013] given a reply that is not a JSON object, when it is checked, then it fails closed as bad-reply", async () => {
    for (const text of ["<html>busy</html>", "", "{\"success\":", "null", "\"success\"", "true"]) {
      const answering: typeof fetch = () => Promise.resolve(new Response(text, { status: 200, headers: { "content-type": "application/json" } }));
      expect({ text, check: await checkTurnstile({ secretKey: TURNSTILE_TEST.passSecret, fetch: answering }, TURNSTILE_TEST.dummyToken, null, "japacity.app") }).toEqual({ text, check: { ok: false, reason: "bad-reply" } });
    }
  });
});
