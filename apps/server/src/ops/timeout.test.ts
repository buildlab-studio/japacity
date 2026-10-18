// server:ledger-alarm-lists-suspects: which requests are the admin's reads, and which failures are their timeout.
import { Hono } from "hono";
import { describe, expect, test, vi } from "vitest";

import { onAppError } from "../security/fail";
import { ADMIN_TIMEOUT_DETAIL, adminRead, adminReadTimedOut } from "./timeout";

const SITE = "https://japacity.example";

/** Postgres's error for a statement stopped by the timeout, as the query builder wraps it. */
const STOPPED = new Error("Failed query: select ...", { cause: Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }) });

describe("the admin's statement timeout", () => {
  test("[server:ledger-alarm-lists-suspects] given a request, then only a GET or HEAD under /api/admin/ is an admin read", () => {
    expect(adminRead(new Request(`${SITE}/api/admin/stats`))).toBe(true);
    expect(adminRead(new Request(`${SITE}/api/admin/report?day=3`, { method: "HEAD" }))).toBe(true);
    expect(adminRead(new Request(`${SITE}/api/admin/switches`, { method: "POST" }))).toBe(false);
    expect(adminRead(new Request(`${SITE}/api/view`))).toBe(false);
    expect(adminRead(new Request(`${SITE}/api/administer`))).toBe(false);
  });

  test("[server:ledger-alarm-lists-suspects] [server:no-platform-error-page] given a statement stopped by a timeout, then on an admin route it is the admin's refusal, and on a game route it stays the server's unavailable", async () => {
    expect(adminReadTimedOut("/api/admin/stats", STOPPED)).toBe(true);
    expect(adminReadTimedOut("/api/admin/stats", new Error("relation does not exist"))).toBe(false);
    expect(adminReadTimedOut("/api/view", STOPPED)).toBe(false);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = new Hono();
    app.onError(onAppError);
    app.get("/api/admin/stats", () => Promise.reject(STOPPED));
    app.get("/api/view", () => Promise.reject(STOPPED));
    const admin = await app.request("/api/admin/stats");
    expect(admin.status).toBe(503);
    expect(await admin.json()).toEqual({ ok: false, code: "not-possible", detail: ADMIN_TIMEOUT_DETAIL });
    const game = await app.request("/api/view");
    expect(game.status).toBe(503);
    expect(await game.json()).toMatchObject({ ok: false, code: "unavailable" });
    vi.restoreAllMocks();
  });
});
