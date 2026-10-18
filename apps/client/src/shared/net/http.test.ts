import { afterEach, describe, expect, test, vi } from "vitest";

import { BASE } from "../testing/server";
import { api, classify, COMMAND_TIMEOUT_MS, failureOf, type Fetch, isReloading, READ_TIMEOUT_MS } from "./http";
import { WALL_AGAIN_MS, WALL_SETTLE_MS, wallGuard, type WallGuard } from "./wall";
import { WALL_KEY } from "../kept/storage";
import { removableStorage } from "../testing/storage";

/** A wall that never reloads: these tests read the kind alone. */
const noWall: WallGuard = { met: () => false, passed: () => undefined };

/** A response as the browser hands it back, with the fields a real `Response` cannot be built with (an opaque redirect). */
function answered(status: number, text: string, extra: { type?: ResponseType; redirected?: boolean; contentType?: string } = {}): Response {
  return {
    status,
    type: extra.type ?? "basic",
    redirected: extra.redirected ?? false,
    headers: new Headers(extra.contentType === undefined ? {} : { "content-type": extra.contentType }),
    text: () => Promise.resolve(text),
  } as Response;
}

/** The kind a request comes back as: "ok", "rejected", or the failure's kind. */
async function kindOf(fetch: Fetch, call: (http: ReturnType<typeof api>) => Promise<unknown> = (http) => http.get("/api/view")): Promise<string> {
  try {
    const body = (await call(api({ baseUrl: BASE, fetch, wall: noWall }))) as { ok?: boolean };
    return body.ok === false ? "rejected" : "ok";
  } catch (error) {
    return failureOf(error) ?? `unclassified: ${String(error)}`;
  }
}

const JSON_TYPE = "application/json";
const HTML_TYPE = "text/html; charset=UTF-8";
const ACCESS_PAGE = "<!doctype html><html><head><title>Sign in</title></head><body>Get a login code emailed to you</body></html>";

afterEach(() => {
  vi.useRealTimers();
});

describe("every request fails loudly and in kind (R-ENGINE-015)", () => {
  test("[R-ENGINE-015] given the fetch throws as Safari does on a login wall's cross-origin redirect (Load failed), then the request fails as network and carries the kind, not the browser's words", async () => {
    const error: unknown = await api({ baseUrl: BASE, fetch: () => Promise.reject(new TypeError("Load failed")), wall: noWall })
      .get("/api/view")
      .catch((caught: unknown) => caught);
    expect(failureOf(error)).toBe("network");
  });

  test("[R-ENGINE-015] given a read with no answer, then it fails as network at 8 seconds and not before", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const hanging: Fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    const read = kindOf(hanging);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await read).toBe("network");
    expect(READ_TIMEOUT_MS).toBe(8_000);
  });

  test("[R-ENGINE-015] given a command with no answer, then it fails as network at 15 seconds and not before", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const hanging: Fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    const sent = kindOf(hanging, (http) => http.post("/api/command", {}));
    await vi.advanceTimersByTimeAsync(COMMAND_TIMEOUT_MS - 1);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await sent).toBe("network");
    expect(COMMAND_TIMEOUT_MS).toBe(15_000);
  });

  test("[R-ENGINE-015] given any request, then it goes same-origin with the cookie, never follows a redirect, and carries a signal for its clock", async () => {
    const seen: RequestInit[] = [];
    const fetch: Fetch = (_input, init) => {
      seen.push(init ?? {});
      return Promise.resolve(answered(200, JSON.stringify({ ok: true }), { contentType: JSON_TYPE }));
    };
    const http = api({ baseUrl: BASE, fetch, wall: noWall });
    await http.get("/api/view");
    await http.post("/api/command", {});
    for (const init of seen) {
      expect(init.credentials).toBe("same-origin");
      expect(init.redirect).toBe("manual");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  test("[R-ENGINE-015] [R-ACCOUNT-006] given the Access login wall's answers to a fetch (an opaque redirect, a 302 to its login, its 401 page), then each is a wall", async () => {
    expect(await kindOf(() => Promise.resolve(answered(0, "", { type: "opaqueredirect" })))).toBe("wall");
    const toLogin = { ...answered(302, ""), headers: new Headers({ location: "https://example-team.cloudflareaccess.com/cdn-cgi/access/login/staging.japacity.app?redirect_url=%2Fapi%2Fview" }) } as Response;
    expect(classify(toLogin, "")).toEqual({ kind: "wall", detail: "redirected to the Access login (302)" });
    expect(await kindOf(() => Promise.resolve(answered(302, "", { contentType: HTML_TYPE })))).toBe("wall");
    expect(await kindOf(() => Promise.resolve(answered(401, ACCESS_PAGE, { contentType: HTML_TYPE })))).toBe("wall");
    expect(await kindOf(() => Promise.resolve(answered(200, ACCESS_PAGE, { redirected: true, contentType: HTML_TYPE })))).toBe("wall");
  });

  test("[R-ENGINE-015] [R-ACCOUNT-006] given a 401 or 403 with no JSON of the server's, or a page where JSON was expected, then it is a wall", async () => {
    expect(await kindOf(() => Promise.resolve(answered(401, "")))).toBe("wall");
    expect(await kindOf(() => Promise.resolve(answered(403, "Forbidden", { contentType: "text/plain" })))).toBe("wall");
    expect(await kindOf(() => Promise.resolve(answered(200, ACCESS_PAGE, { contentType: HTML_TYPE })))).toBe("wall");
  });

  test("[R-ACCOUNT-006] given a 403 with a JSON body (only the game's Worker answers in JSON: the auth library's refusal of a passkey, R-ACCOUNT-003), then it is the server's answer, never a wall that would reload the page", () => {
    const refused = JSON.stringify({ code: "PASSKEY_FIRST", message: "Use a passkey session." });
    expect(classify(answered(403, refused, { contentType: JSON_TYPE }), refused)).toEqual({ kind: "rejected", body: { code: "PASSKEY_FIRST", message: "Use a passkey session." } });
  });

  test("[R-ACCOUNT-006] given the game's own 401 with signed-out in its body, then it is the game's refusal, not a wall: the account screens take it", async () => {
    const signedOut = JSON.stringify({ ok: false, code: "signed-out", detail: "Sign in to play." });
    expect(await kindOf(() => Promise.resolve(answered(401, signedOut, { contentType: JSON_TYPE })))).toBe("rejected");
  });

  test("[R-ENGINE-015] given a 5xx with no refusal of the game's, then it is server; the game's own 503 (switched-off) stays its refusal", async () => {
    expect(await kindOf(() => Promise.resolve(answered(500, "")))).toBe("server");
    expect(await kindOf(() => Promise.resolve(answered(502, "<html>Bad gateway</html>", { contentType: HTML_TYPE })))).toBe("server");
    expect(await kindOf(() => Promise.resolve(answered(500, JSON.stringify({ error: "boom" }), { contentType: JSON_TYPE })))).toBe("server");
    const off = JSON.stringify({ ok: false, code: "switched-off", detail: "Closed for now.", retryAfter: 30 });
    expect(await kindOf(() => Promise.resolve(answered(503, off, { contentType: JSON_TYPE })))).toBe("rejected");
  });

  test("[R-ENGINE-015] [R-SERVER-043] given the server's own failure (unavailable) with a 503 and its wait, or with a 500, then it is server, never a refusal the game would show as one", async () => {
    const down = JSON.stringify({ ok: false, code: "unavailable", detail: "The game's server could not reach its database. Try again shortly.", retryAfter: 5 });
    const broke = JSON.stringify({ ok: false, code: "unavailable", detail: "Something broke on the game's server." });
    const reply503 = { ...answered(503, down, { contentType: JSON_TYPE }), headers: new Headers({ "content-type": JSON_TYPE, "Retry-After": "5" }) } as Response;
    expect(classify(reply503, down)).toEqual({ kind: "server", detail: "503 unavailable" });
    expect(await kindOf(() => Promise.resolve(answered(503, down, { contentType: JSON_TYPE })))).toBe("server");
    expect(await kindOf(() => Promise.resolve(answered(500, broke, { contentType: JSON_TYPE })))).toBe("server");
  });

  test("[R-ENGINE-015] given the game's own 409 with its code, then it is rejected and the body comes back as the server sent it", async () => {
    const stale = { ok: false, code: "stale", detail: "The state moved on." };
    const body = await api({ baseUrl: BASE, fetch: () => Promise.resolve(answered(409, JSON.stringify(stale), { contentType: JSON_TYPE })), wall: noWall }).post("/api/command", {});
    expect(body).toEqual(stale);
    expect(classify(answered(409, JSON.stringify(stale), { contentType: JSON_TYPE }), JSON.stringify(stale))).toEqual({ kind: "rejected", body: stale });
  });

  test("[R-ENGINE-015] given a bare 429 from the platform's limiter, then it reads as the game's rate-limited refusal with its wait", () => {
    const limited = { ...answered(429, ""), headers: new Headers({ "Retry-After": "7" }) } as Response;
    expect(classify(limited, "")).toEqual({ kind: "rejected", body: { ok: false, code: "rate-limited", detail: "Too many requests.", retryAfter: 7 } });
  });

  test("[R-ENGINE-015] given a 200 with the game's JSON, then it is ok", async () => {
    expect(await kindOf(() => Promise.resolve(answered(200, JSON.stringify({ ok: true, view: {} }), { contentType: JSON_TYPE })))).toBe("ok");
  });
});

/** A tab's session storage, a clock the test moves, and the reloads counted. */
function tab() {
  const storage = removableStorage();
  const { items } = storage;
  let time = 1_000_000;
  let reloads = 0;
  const guard = wallGuard({ storage: () => storage, now: () => time, reload: () => (reloads += 1) });
  return { guard, items, reloads: () => reloads, advance: (ms: number) => (time += ms) };
}

describe("the login wall reloads the page once (R-ACCOUNT-006)", () => {
  const opaque: Fetch = () => Promise.resolve(answered(0, "", { type: "opaqueredirect" }));
  const fine: Fetch = () => Promise.resolve(answered(200, JSON.stringify({ ok: true }), { contentType: JSON_TYPE }));
  const get = (fetch: Fetch, wall: WallGuard) => api({ baseUrl: BASE, fetch, wall }).get("/api/view").catch((caught: unknown) => caught);

  test("[R-ACCOUNT-006] given an /api reply that is an opaque redirect, then the page reloads once so the Access login shows, and the failure says it is reloading", async () => {
    const { guard, reloads, items } = tab();
    const error = await get(opaque, guard);
    expect(failureOf(error)).toBe("wall");
    expect(isReloading(error)).toBe(true);
    expect(reloads()).toBe(1);
    expect(items.has(WALL_KEY)).toBe(true);
  });

  test("[R-ACCOUNT-006] given a second wall within a minute of the reload, then nothing reloads again: the card with Reload says it", async () => {
    const { guard, reloads, advance } = tab();
    await get(opaque, guard);
    advance(WALL_AGAIN_MS - 1);
    const again = await get(opaque, guard);
    expect(reloads()).toBe(1);
    expect(failureOf(again)).toBe("wall");
    expect(isReloading(again)).toBe(false);
    advance(1);
    await get(opaque, guard);
    expect(reloads()).toBe(2);
  });

  test("[R-ACCOUNT-006] given a route that answers within 3 seconds of the reload beside one that is walled (a host walled in part), then the mark stands and the page never reloads in a loop", async () => {
    const { guard, reloads, items, advance } = tab();
    await get(opaque, guard);
    advance(WALL_SETTLE_MS - 1);
    await get(fine, guard);
    expect(items.has(WALL_KEY)).toBe(true);
    await get(opaque, guard);
    expect(reloads()).toBe(1);
  });

  test("[R-ACCOUNT-006] given the game answers 3 seconds or more after the reload, then the mark is cleared and a later wall reloads once again", async () => {
    const { guard, reloads, items, advance } = tab();
    await get(opaque, guard);
    advance(WALL_SETTLE_MS);
    await get(fine, guard);
    expect(items.has(WALL_KEY)).toBe(false);
    await get(opaque, guard);
    expect(reloads()).toBe(2);
  });

  test("[R-ACCOUNT-006] given no session storage to mark the reload in, then nothing reloads: a loop cannot be told from a first time, and the card says it", async () => {
    let reloads = 0;
    const guard = wallGuard({ storage: () => null, now: () => 0, reload: () => (reloads += 1) });
    const error = await get(opaque, guard);
    expect(isReloading(error)).toBe(false);
    expect(reloads).toBe(0);
  });

  test("[R-ENGINE-015] given a network or server failure, then nothing reloads", async () => {
    const { guard, reloads } = tab();
    await get(() => Promise.reject(new TypeError("Load failed")), guard);
    await get(() => Promise.resolve(answered(500, "")), guard);
    expect(reloads()).toBe(0);
  });
});
