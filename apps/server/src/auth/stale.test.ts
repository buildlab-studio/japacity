// R-ACCOUNT-021, R-ACCOUNT-023: a browser still holding a validly signed session
// cookie whose session is gone (a database reset, a deletion, a guest clean-up,
// sessions ended elsewhere) starts a guest or signs in like any other browser.
// The auth library's anonymous link reads the request's session after every
// sign-in and, finding the dead one, would expire the cookie it just set.
import { afterEach, describe, expect, test, vi } from "vitest";

import { PASS_COOKIE } from "../account/age";
import { DEVICE_COOKIE } from "../account/guest";
import { softwarePasskey } from "./passkey.testing";
import { headersWithoutSession } from "./stale";
import { harness } from "./auth.testing";
import type { Harness, Jar } from "./auth.testing";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SESSION = "__Secure-better-auth.session_token";

/** Ends every session of the account on the server, as a reset or a sign-out elsewhere does; the jar keeps its cookie. */
async function endSessions(h: Harness, jar: Jar, account: string): Promise<() => void> {
  const stale = jar.cookies.get(SESSION);
  if (stale === undefined || stale === "") throw new Error("The jar holds no session cookie.");
  await (await h.auth.$context).internalAdapter.deleteUserSessions(account);
  // Puts the dead cookie back, for a step after one whose reply may have expired it.
  return () => {
    jar.cookies.set(SESSION, stale);
  };
}

/** The session cookie a reply sets, or null. */
function sessionSet(reply: Response): string | null {
  const line = reply.headers.getSetCookie().find((each) => each.startsWith(`${SESSION}=`));
  if (line === undefined) return null;
  const value = (line.split(";")[0] ?? "").slice(SESSION.length + 1);
  return value === "" || /;\s*max-age=0/i.test(line) ? null : value;
}

function unsignedJwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
}

/** Google's round trip from the jar, its token endpoint answered here; `between` runs before the callback. Returns the callback's reply. */
async function withGoogle(h: Harness, jar: Jar, identity: { sub: string; email: string }, between: () => void): Promise<Response> {
  const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, json: { provider: "google", callbackURL: "/?google=in", errorCallbackURL: "/" } });
  const state = new URL(String((await start.json<{ url: string }>()).url)).searchParams.get("state") ?? "";
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://oauth2.googleapis.com/token")) return real(input, init);
    const idToken = unsignedJwt({ ...identity, email_verified: true, iss: "https://accounts.google.com" });
    return Promise.resolve(Response.json({ access_token: "google-access-token", refresh_token: "google-refresh-token", id_token: idToken, token_type: "Bearer", expires_in: 3600 }));
  });
  between();
  const back = await h.call(`/api/auth/callback/google?code=stub-code&state=${state}`, { jar });
  vi.unstubAllGlobals();
  return back;
}

async function accountId(h: Harness, jar: Jar): Promise<{ status: number; id: string | null }> {
  const reply = await h.call("/api/account", { jar });
  const body = await reply.json<{ account?: { id: string } }>();
  return { status: reply.status, id: body.account?.id ?? null };
}

describe("a dead session cookie never stops a new sign-in", () => {
  test("[R-ACCOUNT-021] given a browser whose guest's sessions were ended, when it passes the age screen and starts a guest again, then the new guest's session cookie is set and the account opens", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    await endSessions(h, jar, account);
    expect((await h.call("/api/account", { jar })).status).toBe(401);

    expect((await h.passAge(jar)).status).toBe(200);
    const started = await h.startGuest(jar);
    expect(started.status).toBe(200);
    const made = (await started.json<{ account: { id: string } }>()).account.id;
    expect(sessionSet(started)).not.toBeNull();

    expect(await accountId(h, jar)).toEqual({ status: 200, id: made });
    expect(made).not.toBe(account);
  });

  test("[R-ACCOUNT-023] given a life kept by a code whose sessions were ended, when the same browser signs in by a code again, then the session cookie is set and the kept life opens", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    await endSessions(h, jar, account);

    const signed = await h.secureByCode(jar, "ada@example.com");
    expect(signed.status).toBe(200);
    expect(sessionSet(signed)).not.toBeNull();
    expect(await accountId(h, jar)).toEqual({ status: 200, id: account });
  });

  test("[R-ACCOUNT-023] given a life kept by a code whose sessions were ended, when Google with the same verified address comes back to a browser still sending the dead cookie, then the session cookie is set and the kept life opens", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const restore = await endSessions(h, jar, account);

    const back = await withGoogle(h, jar, { sub: "google-ada", email: "ada@example.com" }, restore);
    expect(new URL(back.headers.get("location") ?? "/", "https://japacity.test").searchParams.get("error")).toBeNull();
    expect(sessionSet(back)).not.toBeNull();
    expect(await accountId(h, jar)).toEqual({ status: 200, id: account });
  });

  test("[R-ACCOUNT-023] given a kept life with a passkey whose sessions were ended, when the passkey signs in from a browser still sending the dead cookie, then the session cookie is set and the kept life opens", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const key = await softwarePasskey();
    await key.store(h, account);
    const restore = await endSessions(h, jar, account);

    const signed = await key.signIn(h, jar, () => Promise.resolve(restore()));
    expect(signed.status).toBe(200);
    expect(await accountId(h, jar)).toEqual({ status: 200, id: account });
  });

  test("[R-ACCOUNT-023] given a guest whose session is live, when it secures the life by a code, then the guest's own account is kept: a live cookie still links", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const signed = await h.secureByCode(jar, "ada@example.com");
    expect(signed.status).toBe(200);
    expect(await accountId(h, jar)).toEqual({ status: 200, id: account });
  });
});

describe("the cookies a dead session leaves behind", () => {
  test("[R-ACCOUNT-021] given a Cookie header with the library's session cookies, secure-named or not and chunked, when they are dropped, then every other cookie is kept as it came, and the header stays when nothing is left", async () => {
    const h = harness();
    const cookie = [
      "__Secure-better-auth.session_token=abc.def%3D",
      `${PASS_COOKIE}=pass.value==`,
      "better-auth.session_token=plain",
      "__Secure-better-auth.session_data.0=chunk",
      "__Secure-better-auth.dont_remember=yes",
      `${DEVICE_COOKIE}=0123abcd`,
      "__Secure-better-auth.account_data=x",
      "__Secure-better-auth.oauth_state=kept",
    ].join("; ");
    const out = await headersWithoutSession(h.auth, new Headers({ cookie, "x-other": "1" }));
    expect(out.get("cookie")).toBe(`${PASS_COOKIE}=pass.value==; ${DEVICE_COOKIE}=0123abcd; __Secure-better-auth.oauth_state=kept`);
    expect(out.get("x-other")).toBe("1");
    // An empty header is kept, so the library still checks the origin of a write that came with cookies.
    expect((await headersWithoutSession(h.auth, new Headers({ cookie: "__Secure-better-auth.session_token=abc" }))).get("cookie")).toBe("");
    expect((await headersWithoutSession(h.auth, new Headers({ "x-other": "1" }))).has("cookie")).toBe(false);
  });
});
