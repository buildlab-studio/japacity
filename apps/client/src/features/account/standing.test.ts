// The account as the server last said it (server:per-account-rate-limits): a read the server refuses, over the read limit
// or out of reach, is no answer, so the last good account stands for every screen that shows it.
import { describe, expect, test } from "vitest";

import type { AccountApi } from "../../shared/net/auth";
import { accountView } from "../../shared/testing/fixtures";
import { refreshAccount } from "./standing";

/** An account seam that answers its view from `answers` in turn, the last one repeating. */
function seam(...answers: (ReturnType<typeof accountView> | null)[]): AccountApi {
  let at = 0;
  const view = (): Promise<ReturnType<typeof accountView> | null> => Promise.resolve(answers[Math.min(at++, answers.length - 1)] ?? null);
  return { view } as Partial<AccountApi> as AccountApi;
}

describe("the account kept through a refused read", () => {
  test("[server:per-account-rate-limits] given the account read once, when it is read again and the server gives no answer, then the last good account stands", async () => {
    const guest = accountView({ state: "guest" });
    const account = seam(guest, null);
    expect(await refreshAccount(account)).toEqual(guest);
    expect(await refreshAccount(account)).toEqual(guest);
  });

  test("[server:per-account-rate-limits] given the account read once, when it is read again and has changed, then the new account stands", async () => {
    const guest = accountView({ state: "guest" });
    const kept = accountView({ state: "secured" });
    const account = seam(guest, kept);
    expect(await refreshAccount(account)).toEqual(guest);
    expect(await refreshAccount(account)).toEqual(kept);
  });
});
