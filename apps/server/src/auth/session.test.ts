import { describe, expect, test, vi } from "vitest";

import { sessionReader } from "./session";
import { SITE, harness } from "./auth.testing";

describe("the session reader", () => {
  test("[account:stand-ins-test-sign-in] [moderation:admin-view-for-admin-list] given a session from the test utilities' login, when a request carries it, then the reader gives its account and no passkey, since no passkey opened it; with none it gives null", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const { headers } = await (await h.helpers()).login({ userId: account });
    const read = sessionReader(h.auth, h.deps);
    expect(await read(new Request(`${SITE}/api/view`, { headers }))).toEqual({ account, passkey: false });
    expect(await read(new Request(`${SITE}/api/view`))).toBeNull();
  });
});

const SESSION = "__Secure-better-auth.session_token";

/** The reply's `Set-Cookie` lines for the session token. */
function sessionLines(reply: Response): string[] {
  return reply.headers.getSetCookie().filter((line) => line.startsWith(`${SESSION}=`));
}

function expires(line: string): boolean {
  return /;\s*max-age=0\s*(?:;|$)/i.test(line);
}

describe("the cookies a session read sets", () => {
  test("[account:dead-cookie-expired-on-first-read] given a browser holding a validly signed session cookie whose session row is gone, when it reads its account, then the reply is the game's signed-out 401 and expires the session cookie, and the next read carries none", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    await (await h.auth.$context).internalAdapter.deleteUserSessions(account);
    expect(jar.cookies.get(SESSION)).toBeDefined();

    const reply = await h.call("/api/account", { jar });
    expect(reply.status).toBe(401);
    expect(await reply.json()).toMatchObject({ code: "signed-out" });
    const lines = sessionLines(reply);
    expect(lines).toHaveLength(1);
    expect(expires(lines[0] ?? "")).toBe(true);
    expect(jar.cookies.has(SESSION)).toBe(false);

    const again = await h.call("/api/account", { jar });
    expect(again.status).toBe(401);
    expect(sessionLines(again)).toEqual([]);
  });

  test("[account:dead-cookie-expired-on-first-read] given a browser holding a dead session cookie, when it starts a guest, then the session is read once and the reply ends with the new guest's live session cookie, never an expiry of it", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const dead = jar.cookies.get(SESSION);
    await (await h.auth.$context).internalAdapter.deleteUserSessions(account);
    expect((await h.passAge(jar)).status).toBe(200);
    // The age screen read the session and expired the dead cookie; it is put back, as a browser that dropped that reply would hold it.
    expect(jar.cookies.has(SESSION)).toBe(false);
    if (dead === undefined) throw new Error("The guest has no session cookie.");
    jar.cookies.set(SESSION, dead);

    const reads = vi.spyOn(h.auth.api, "getSession");
    const started = await h.startGuest(jar);
    expect(started.status).toBe(200);
    expect(reads).toHaveBeenCalledTimes(1);
    const lines = sessionLines(started);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some(expires)).toBe(false);
    expect(jar.cookies.get(SESSION)).not.toBe(dead);

    const made = (await started.json<{ account: { id: string } }>()).account.id;
    const opened = await h.call("/api/account", { jar });
    expect(opened.status).toBe(200);
    expect((await opened.json<{ account: { id: string } }>()).account.id).toBe(made);
  });

  test("[account:session-renewal-reaches-browser] given a live session last renewed more than a day ago, when the browser reads its account, then the session is read once, renewed for its full life, and the reply sets the renewed cookie; a read soon after sets none", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const context = await h.auth.$context;
    const { expiresIn, updateAge } = context.sessionConfig;
    const [row] = await context.internalAdapter.listSessions(account);
    if (row === undefined) throw new Error("The guest has no session.");
    await context.internalAdapter.updateSession(row.token, { expiresAt: new Date(Date.now() + (expiresIn - updateAge - 60) * 1000) });

    const reads = vi.spyOn(h.auth.api, "getSession");
    const reply = await h.call("/api/account", { jar });
    expect(reply.status).toBe(200);
    expect(reads).toHaveBeenCalledTimes(1);
    const lines = sessionLines(reply);
    expect(lines).toHaveLength(1);
    expect(expires(lines[0] ?? "")).toBe(false);
    expect(lines[0]).toMatch(new RegExp(`max-age=${String(expiresIn)}`, "i"));
    const [renewed] = await context.internalAdapter.listSessions(account);
    expect(renewed?.expiresAt.getTime() ?? 0).toBeGreaterThan(Date.now() + (expiresIn - 120) * 1000);

    const soon = await h.call("/api/account", { jar });
    expect(soon.status).toBe(200);
    expect(sessionLines(soon)).toEqual([]);
  });
});
