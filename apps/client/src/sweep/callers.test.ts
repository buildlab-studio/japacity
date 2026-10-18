// R-ENGINE-015, R-ACCOUNT-006: the callers beyond the authority (the age screen, the guest start, the auth library's
// code and passkey calls, the notice's routes) go through the one request function, so a wall or no answer there is
// sorted like the rest: the wall sets off the page's one reload, and no answer is said as the screen's own failure.
import { afterEach, describe, expect, test, vi } from "vitest";

import { httpNotifyApi } from "../features/notify/notify.api";
import { BASE } from "../shared/testing/server";
import { betterAuthApi } from "../shared/net/auth";
import { type Fetch, READ_TIMEOUT_MS } from "../shared/net/http";
import type { WallGuard } from "../shared/net/wall";

afterEach(() => {
  vi.useRealTimers();
});

/** A guard that counts the walls met, as the page's would reload for the first. */
function counted(): { guard: WallGuard; walls: () => number } {
  let walls = 0;
  return {
    guard: {
      met: () => {
        walls += 1;
        return true;
      },
      passed: () => undefined,
    },
    walls: () => walls,
  };
}

/** What the Access wall answers to a fetch that does not follow it. */
const walled: Fetch = () => Promise.resolve({ status: 0, type: "opaqueredirect", redirected: false, statusText: "", headers: new Headers(), text: () => Promise.resolve("") } as Response);
const loadFailed: Fetch = () => Promise.reject(new TypeError("Load failed"));
/** A fetch that never answers until its signal gives up. */
const hanging: Fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
  });

describe("the account's calls go through the one request function", () => {
  test("[R-ACCOUNT-006] given the wall in front of GET /api/age, then the page's one reload is set off and the age screen still asks", async () => {
    const { guard, walls } = counted();
    const account = betterAuthApi({ baseUrl: BASE, fetch: walled, wall: guard });
    expect(await account.ageStatus()).toBe("unasked");
    expect(walls()).toBe(1);
  });

  test("[R-ACCOUNT-006] given the wall in front of POST /api/age, POST /api/guest and the auth library's code route, then each sets off the wall and says unreachable", async () => {
    const { guard, walls } = counted();
    const account = betterAuthApi({ baseUrl: BASE, fetch: walled, wall: guard });
    await expect(account.declareAge("2000-02-29")).rejects.toMatchObject({ failure: "wall" });
    expect(await account.startGuest("ada_lagos", "token")).toEqual({ ok: false, why: "unreachable" });
    expect(await account.sendCode("ada@example.test", null)).toEqual({ ok: false, why: "unreachable" });
    expect(walls()).toBe(3);
  });

  test("[R-ENGINE-015] given the guest start and the passkey's sign-in with no answer, then each is said as unreachable, never the browser's words", async () => {
    const account = betterAuthApi({ baseUrl: BASE, fetch: loadFailed, wall: counted().guard });
    expect(await account.startGuest("ada_lagos", null)).toEqual({ ok: false, why: "unreachable" });
    expect(await account.signInWithPasskey()).toEqual({ ok: false, why: "unreachable" });
  });

  test("[R-ENGINE-015] given GET /api/age with no answer, then it gives up at 8 seconds and the age screen asks", async () => {
    vi.useFakeTimers();
    const account = betterAuthApi({ baseUrl: BASE, fetch: hanging, wall: counted().guard });
    const asked = account.ageStatus();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    expect(await asked).toBe("unasked");
  });
});

describe("the notice's calls go through the one request function", () => {
  test("[R-ACCOUNT-006] given the wall in front of the notice's routes, then the wall is set off and the setting says it cannot be read", async () => {
    const { guard, walls } = counted();
    const notify = httpNotifyApi(BASE, walled, guard);
    expect(await notify.status()).toBeNull();
    expect(walls()).toBe(2);
  });

  test("[R-ENGINE-015] given the notice's routes with no answer, then each comes back as not done, at its clock", async () => {
    vi.useFakeTimers();
    const notify = httpNotifyApi(BASE, hanging, counted().guard);
    const turning = notify.turnOff();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await turning).toBe(false);
  });
});
