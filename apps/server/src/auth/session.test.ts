import { describe, expect, test } from "vitest";

import { sessionReader } from "./session";
import { SITE, harness } from "./testing";

describe("the session reader", () => {
  test("[R-ACCOUNT-005] given a session from the test utilities' login, when a request carries it, then the reader gives its account; with none it gives null", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const { headers } = await (await h.helpers()).login({ userId: account });
    const read = sessionReader(h.auth);
    expect(await read(new Request(`${SITE}/api/view`, { headers }))).toEqual({ account });
    expect(await read(new Request(`${SITE}/api/view`))).toBeNull();
  });
});
