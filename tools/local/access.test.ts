import { describe, expect, test } from "vitest";

import { accessHeaders, realRun, realTarget, STAGING_URL } from "./access";

// Stand-ins: the real values live only in the maintainer's keychain.
const TOKEN = { CF_ACCESS_CLIENT_ID: "id-standin.access", CF_ACCESS_CLIENT_SECRET: "secret-standin" };
const LOCAL = "https://localhost:8787";

describe("staging behind Access", () => {
  test("[R-SERVER-038] given both Access variables, when staging is the target, then its two headers are attached", () => {
    expect(accessHeaders(TOKEN, STAGING_URL)).toEqual({ "CF-Access-Client-Id": "id-standin.access", "CF-Access-Client-Secret": "secret-standin" });
    expect(realTarget({ ...TOKEN, REAL_BASE_URL: STAGING_URL }, LOCAL)).toEqual({ baseUrl: STAGING_URL, local: false, headers: accessHeaders(TOKEN, STAGING_URL) });
  });

  test("[R-SERVER-038] given either Access variable missing or empty, when staging is the target, then no header is attached", () => {
    for (const env of [{}, { CF_ACCESS_CLIENT_ID: TOKEN.CF_ACCESS_CLIENT_ID }, { CF_ACCESS_CLIENT_SECRET: TOKEN.CF_ACCESS_CLIENT_SECRET }, { CF_ACCESS_CLIENT_ID: "", CF_ACCESS_CLIENT_SECRET: "" }]) {
      expect(accessHeaders(env, STAGING_URL)).toEqual({});
    }
  });

  test("[R-SERVER-038] given both Access variables, when the target is the local stack or a plain http address, then no header is attached", () => {
    for (const url of [LOCAL, "https://127.0.0.1:6592", "http://staging.japacity.app", "not an address"]) expect(accessHeaders(TOKEN, url)).toEqual({});
    expect(realTarget(TOKEN, LOCAL)).toEqual({ baseUrl: LOCAL, local: true, headers: {} });
  });

  test("[R-SERVER-038] given --staging, when the real tests are run, then they point at staging and Playwright gets the other arguments only", () => {
    expect(realRun(["--staging", "-g", "Credits"], { PATH: "/bin" })).toEqual({ env: { PATH: "/bin", REAL_BASE_URL: STAGING_URL }, args: ["-g", "Credits"] });
    expect(realRun(["--", "-g", "way in"], {})).toEqual({ env: {}, args: ["-g", "way in"] });
  });
});
