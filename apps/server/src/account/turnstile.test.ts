import { describe, expect, test } from "vitest";

import { checkTurnstile, TURNSTILE_TEST } from "./turnstile";

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

  test("[R-ACCOUNT-013] given a pass on SITE_URL's own host, when it is checked, then it is accepted as before", async () => {
    expect(await checkTurnstile(keys({ success: true, hostname: "japacity.app" }), TURNSTILE_TEST.dummyToken, null, "japacity.app")).toEqual({ ok: true });
  });
});
