/// <reference types="@cloudflare/vitest-plugin/types" />
// account:guest-and-secured-states in the Workers runtime: the sign-in paths hand the library a
// copy of the request without the dead session cookie, and the copy must keep
// the request's body (the email code, the passkey's answer) as workerd moves it.
// Here, unlike under Node, the library checks the origin of a write that
// carries cookies, so every write names the site as a browser on it would.
import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import { softwarePasskey } from "./passkey.testing";
import { dropDeadSession } from "./stale";
import { SITE, harness, makeJar } from "./auth.testing";
import type { Harness, Jar } from "./auth.testing";

const SESSION = "__Secure-better-auth.session_token";

/** The harness with every request naming `origin`, as a browser's write does, unless the request already names one. */
function from(h: Harness, origin: string): Harness {
  return {
    ...h,
    call: (path, init = {}) => {
      const headers = new Headers(init.headers);
      if (!headers.has("origin")) headers.set("origin", origin);
      return h.call(path, { ...init, headers });
    },
  };
}

/** A code sent to `email` and signed in with from `h`; the sign-in's reply. */
async function byCode(h: Harness, jar: Jar, email: string, signInFrom: Harness = h): Promise<Response> {
  const asked = await h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", jar, json: { email, type: "sign-in" } });
  expect(asked.status).toBe(200);
  const otp = h.sent.findLast((message) => message.email === email)?.otp ?? "";
  return signInFrom.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email, otp } });
}

/** A kept life with a passkey, its sessions ended; the jar still sends the dead cookie. */
async function keptAndEnded(h: Harness): Promise<{ jar: Jar; account: string; stale: string; key: Awaited<ReturnType<typeof softwarePasskey>> }> {
  const { jar, account } = await h.guest(makeJar());
  expect((await byCode(h, jar, "ada@example.com")).status).toBe(200);
  const key = await softwarePasskey();
  await key.store(h, account);
  const stale = jar.cookies.get(SESSION) ?? "";
  expect(stale).not.toBe("");
  await (await h.auth.$context).internalAdapter.deleteUserSessions(account);
  return { jar, account, stale, key };
}

async function opened(h: Harness, jar: Jar): Promise<string | null> {
  const reply = await h.call("/api/account", { jar });
  return reply.status === 200 ? (await reply.json<{ account: { id: string } }>()).account.id : null;
}

describe("a dead session cookie on the Workers runtime", () => {
  test("[account:guest-and-secured-states] given a kept life whose sessions were ended, when the same browser signs in by a code and then by its passkey, then each POST body reaches the library and the kept life opens", async () => {
    const h = from(harness(), SITE);
    const { jar, account, stale, key } = await keptAndEnded(h);

    expect((await byCode(h, jar, "ada@example.com")).status).toBe(200);
    expect(jar.cookies.get(SESSION)).not.toBe(stale);
    expect(await opened(h, jar)).toBe(account);

    await (await h.auth.$context).internalAdapter.deleteUserSessions(account);
    jar.cookies.set(SESSION, stale);
    expect((await key.signIn(h, jar)).status).toBe(200);
    expect(await opened(h, jar)).toBe(account);
  });

  test("[account:guest-and-secured-states] given a dead session cookie as the only cookie, when another part of the site signs in by a code with it, then the library still refuses the origin and no session is opened", async () => {
    const h = from(harness(), SITE);
    const { jar, stale } = await keptAndEnded(h);
    for (const name of [...jar.cookies.keys()]) if (name !== SESSION) jar.cookies.delete(name);

    const refused = await byCode(h, jar, "ada@example.com", from(h, "https://elsewhere.japacity.test"));
    expect(refused.status).toBe(403);
    expect(await refused.json<{ code?: string }>()).toMatchObject({ code: "INVALID_ORIGIN" });
    expect(jar.cookies.get(SESSION)).toBe(stale);
  });

  test("[account:guest-and-secured-states] given a streamed POST body and a dead session cookie, when the middleware swaps the request, then the next handler reads the whole body and the other cookies, and no session cookie", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    await (await h.auth.$context).internalAdapter.deleteUserSessions(account);
    const app = new Hono();
    app.use("/in", dropDeadSession(h.auth));
    app.post("/in", async (c) => c.json({ body: await c.req.raw.text(), cookie: c.req.raw.headers.get("cookie") }));

    const payload = JSON.stringify({ email: "ada@example.com", otp: "123456" });
    const bytes = new TextEncoder().encode(payload);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 10));
        controller.enqueue(bytes.slice(10));
        controller.close();
      },
    });
    const others = [...jar.cookies].filter(([name]) => name !== SESSION).map(([name, value]) => `${name}=${value}`);
    const reply = await app.request("https://japacity.test/in", { method: "POST", body, headers: { cookie: `${jar.header()}; other=kept`, "content-type": "application/json" } });
    const seen = await reply.json<{ body: string; cookie: string | null }>();
    expect(seen.body).toBe(payload);
    expect(seen.cookie).toBe([...others, "other=kept"].join("; "));
  });
});
