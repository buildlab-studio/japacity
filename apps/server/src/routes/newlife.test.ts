// A new life kept with an email from the ways back in (account:sign-in-without-secret, account:guest-secures-the-life,
// account:email-code-is-short-lived): the send that looks for the account first, the new life's send, the code spent once
// for a proof of the address, and the guest start that consumes the proof.
import type { AccountReply, NameReply } from "@japacity/api";
import { NEW_LIFE_CODE_PATH } from "@japacity/api";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { NEW_LIFE_COOKIE, NEW_LIFE_MARK, NEW_LIFE_PREFIX, NEW_LIFE_TTL_MS } from "../account/newlife";
import { harness, makeJar, withGoogle } from "../auth/auth.testing";
import type { Harness, Jar } from "../auth/auth.testing";
import { banIdentities, emailIdentity } from "../moderation/identities";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const START = Date.parse("2026-10-28T09:00:00Z");

async function json(reply: Response): Promise<Record<string, unknown>> {
  return reply.json<Record<string, unknown>>();
}

/** A send of a sign-in code from the jar's browser, marked for a new life when asked. */
function send(h: Harness, jar: Jar, email: string, over: { newLife?: boolean; ip?: string } = {}): Promise<Response> {
  return h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", jar, ...(over.ip === undefined ? {} : { ip: over.ip }), json: { email, type: "sign-in", ...(over.newLife === true ? { [NEW_LIFE_MARK]: true } : {}) } });
}

/** The code typed for a new life, from the jar's browser. */
function prove(h: Harness, jar: Jar, email: string, code: string, ip?: string): Promise<Response> {
  return h.call(NEW_LIFE_CODE_PATH, { method: "POST", jar, ...(ip === undefined ? {} : { ip }), json: { email, code } });
}

/** The new life's send and its code typed: the jar ends holding the proof. */
async function proved(h: Harness, email: string, jar: Jar = makeJar()): Promise<Jar> {
  const code = await h.codeFor(email, jar, undefined, true);
  const reply = await prove(h, jar, email, code);
  if (reply.status !== 200) throw new Error(`The new life's code answered ${String(reply.status)}: ${await reply.text()}`);
  return jar;
}

/** The age screen and Begin from the jar's browser; the guest start's reply. */
async function begin(h: Harness, jar: Jar): Promise<NameReply> {
  await h.passAge(jar);
  return (await h.startGuest(jar)).json<NameReply>();
}

function userOf(h: Harness, id: string): Record<string, unknown> | undefined {
  return h.tables.user.find((row) => row["id"] === id);
}

describe("the send looks for the account first", () => {
  test("[account:sign-in-without-secret] [account:email-code-is-short-lived] given an address no account uses, when a code is asked for signed out, then it is refused no-account and nothing is mailed; an address an account uses is sent its code", async () => {
    const h = harness();
    await h.signUp("ada@example.com");
    const sent = h.sent.length;
    const refused = await send(h, makeJar(), "nobody@example.com", { ip: "198.51.100.1" });
    expect(refused.status).toBe(403);
    expect(await json(refused)).toMatchObject({ code: "no-account" });
    expect(h.sent.slice(sent)).toEqual([]);
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith("sign-in-otp-"))).toEqual([]);
    expect((await send(h, makeJar(), "Ada@Example.com", { ip: "198.51.100.2" })).status).toBe(200);
    expect(h.sent.slice(sent).map((message) => message.email)).toEqual(["ada@example.com"]);
  });

  test("[account:sign-in-without-secret] [account:sign-in-routes-rate-limited] given sends refused no-account from one address, when one more than the limit is sent in 60 seconds, then it is refused by the limit: a refused check counts", async () => {
    const h = harness();
    const limit = h.deps.config.auth.limits.otpSendPer60s;
    const statuses: number[] = [];
    for (let n = 0; n <= limit; n++) statuses.push((await send(h, makeJar(), `nobody-${String(n)}@example.com`, { ip: "198.51.100.3" })).status);
    expect(statuses).toEqual([...Array.from({ length: limit }, () => 403), 429]);
    expect(h.sent).toEqual([]);
  });

  test("[account:sign-in-without-secret] given a guest keeping its life, when it sends a code to a new address, then the send goes: only a browser with no session is checked", async () => {
    const h = harness();
    const { jar } = await h.guest();
    expect((await send(h, jar, "new@example.com")).status).toBe(200);
    expect(h.sent.map((message) => message.email)).toEqual(["new@example.com"]);
  });

  test("[account:guest-secures-the-life] given an address an account uses, when a new life's send asks for it, then it is refused taken and nothing is mailed", async () => {
    const h = harness();
    await h.signUp("ada@example.com");
    const sent = h.sent.length;
    const reply = await send(h, makeJar(), "ada@example.com", { newLife: true, ip: "198.51.100.4" });
    expect(reply.status).toBe(403);
    expect(await json(reply)).toMatchObject({ code: "taken", message: "That email already has an account. Sign in instead." });
    expect(h.sent.slice(sent)).toEqual([]);
  });

  test("[account:sign-in-without-secret] given a new life's code, when it is typed into the library's own sign-in, then it opens nothing and makes no account", async () => {
    const h = harness();
    const jar = makeJar();
    const otp = await h.codeFor("new@example.com", jar, undefined, true);
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email: "new@example.com", otp } });
    expect(reply.status).toBe(403);
    expect(await json(reply)).toMatchObject({ code: "no-account" });
    expect(h.tables.user).toEqual([]);
  });
});

describe("the code proves the address before the life starts", () => {
  test("[account:guest-secures-the-life] given a new life's code, when it is typed, then it is spent at once, a proof holding the address alone is kept for 30 minutes, and the browser holds it only in an httpOnly cookie", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const jar = makeJar();
    const code = await h.codeFor("Ada@Example.com", jar, undefined, true);
    const reply = await prove(h, jar, "Ada@Example.com", code);
    expect(reply.status).toBe(200);
    expect(await json(reply)).toEqual({ ok: true });
    // The code is gone: the same code proves nothing again.
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith("sign-in-otp-"))).toEqual([]);
    expect(await json(await prove(h, makeJar(), "ada@example.com", code))).toMatchObject({ code: "bad-code" });
    const proofs = h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX));
    expect(proofs).toHaveLength(1);
    expect(proofs[0]?.["value"]).toBe("ada@example.com");
    expect(new Date(String(proofs[0]?.["expiresAt"])).getTime()).toBe(START + NEW_LIFE_TTL_MS);
    const cookie = reply.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${NEW_LIFE_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api(;|$)/);
    expect(cookie).toContain(`Max-Age=${String(NEW_LIFE_TTL_MS / 1000)}`);
    // The proof names no account and is named by the cookie alone.
    expect(String(proofs[0]?.["identifier"])).toBe(NEW_LIFE_PREFIX + (jar.cookies.get(NEW_LIFE_COOKIE) ?? "missing"));
    expect(h.tables.user).toEqual([]);
  });

  test("[account:guest-secures-the-life] [account:email-code-is-short-lived] given a new life's code, when a wrong one, an expired one or one with its tries used up is typed, then each is told apart and no proof is kept", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const jar = makeJar();
    const code = await h.codeFor("ada@example.com", jar, "198.51.100.10", true);
    const wrong = code === "000000" ? "111111" : "000000";
    const said: unknown[] = [];
    for (let n = 0; n < h.deps.config.auth.otp.attempts; n++) said.push((await json(await prove(h, jar, "ada@example.com", wrong))).code);
    said.push((await json(await prove(h, jar, "ada@example.com", code))).code);
    expect(said).toEqual([...Array.from({ length: h.deps.config.auth.otp.attempts }, () => "bad-code"), "too-many"]);

    vi.setSystemTime(START + time.MINUTE_MS);
    const late = await h.codeFor("bola@example.com", jar, "198.51.100.11", true);
    vi.setSystemTime(START + time.MINUTE_MS + h.deps.config.auth.otp.expiresIn * 1000 + 1);
    expect(await json(await prove(h, jar, "bola@example.com", late))).toMatchObject({ code: "expired" });
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
  });

  test("[account:guest-secures-the-life] given a new life's code, when an account took the address before it was typed, then it is refused taken, the code is spent and no proof is kept", async () => {
    const h = harness();
    const jar = makeJar();
    const code = await h.codeFor("ada@example.com", jar, "198.51.100.12", true);
    // Kept with Google, so no second code replaces the first.
    const owner = await h.guest();
    expect((await withGoogle(h, owner.jar, { sub: "google-ada", email: "ada@example.com" })).searchParams.get("error")).toBeNull();
    expect(await json(await prove(h, jar, "ada@example.com", code))).toMatchObject({ code: "taken" });
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);
  });

  test("[account:guest-secures-the-life] [moderation:ban-survives-as-hash] given a banned address, when a new life's code is typed for it, then it is refused not-possible and no proof is kept", async () => {
    const h = harness();
    const jar = makeJar();
    const code = await h.codeFor("bad@example.com", jar, "198.51.100.13", true);
    await banIdentities(h.deps, [emailIdentity("bad@example.com")]);
    expect(await json(await prove(h, jar, "bad@example.com", code))).toMatchObject({ code: "not-possible" });
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);
  });
});

describe("the guest start with a proof", () => {
  test("[account:guest-secures-the-life] given a proof of an address, when the life starts, then the account is born secured by that email with no second code, as a guest that kept its life by the code is", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const reply = await begin(h, jar);
    if (!reply.ok) throw new Error(`The guest start was refused: ${reply.detail}`);
    expect(reply.account).toMatchObject({ state: "secured", ways: { google: null, email: "ada@example.com", passkeys: 0 } });
    expect(reply.emailTaken).toBeUndefined();
    expect(h.sent).toHaveLength(1);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);

    // The same rows and marks as a guest that kept its life by the code.
    const kept = await h.signUp("bola@example.com");
    const born = userOf(h, reply.account.id);
    const keptUser = userOf(h, kept.account);
    for (const field of ["emailVerified", "isAnonymous"]) expect(born?.[field]).toEqual(keptUser?.[field]);
    expect(born).toMatchObject({ email: "ada@example.com", emailVerified: true, isAnonymous: false });
    expect(h.tables.account.filter((row) => row["userId"] === reply.account.id)).toEqual(h.tables.account.filter((row) => row["userId"] === kept.account));
    expect((await h.deps.stores.account.get(reply.account.id))?.state).toBe((await h.deps.stores.account.get(kept.account))?.state);
    const day = time.dayName(time.utcDay(h.deps.now()));
    const secured = (await h.deps.stores.counters.days(day, day)).filter((row) => row.name === "players/secured");
    expect(secured.reduce((sum, row) => sum + row.count, 0)).toBe(2);

    // The life opens in this browser, and the address signs back in to it from another.
    expect((await (await h.call("/api/account", { jar })).json<AccountReply>())).toMatchObject({ ok: true, account: { id: reply.account.id, state: "secured" } });
    const other = makeJar();
    const otp = await h.codeFor("ada@example.com", other, "198.51.100.20");
    const back = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: other, ip: "198.51.100.20", json: { email: "ada@example.com", otp } });
    expect(back.status).toBe(200);
    expect(await (await h.call("/api/account", { jar: other })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: reply.account.id } });
  });

  test("[account:guest-secures-the-life] given no proof, then the life starts as a plain guest and nothing else changes", async () => {
    const h = harness();
    const reply = await begin(h, makeJar());
    if (!reply.ok) throw new Error(`The guest start was refused: ${reply.detail}`);
    expect(reply.account).toMatchObject({ state: "guest", ways: { google: null, email: null, passkeys: 0 } });
    expect(reply.emailTaken).toBeUndefined();
    expect(userOf(h, reply.account.id)).toMatchObject({ isAnonymous: true });
  });

  test("[account:guest-secures-the-life] given a proof made in one browser, when another browser starts a life, even with the proof's cookie copied after its use, then each is a plain guest: the proof is single use and bound to its browser", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const nonce = jar.cookies.get(NEW_LIFE_COOKIE) ?? "";
    const elsewhere = await begin(h, makeJar());
    if (!elsewhere.ok) throw new Error(elsewhere.detail);
    expect(elsewhere.account.state).toBe("guest");
    const own = await begin(h, jar);
    if (!own.ok) throw new Error(own.detail);
    expect(own.account.state).toBe("secured");
    const copied = makeJar();
    copied.cookies.set(NEW_LIFE_COOKIE, nonce);
    const again = await begin(h, copied);
    if (!again.ok) throw new Error(again.detail);
    expect(again.account.state).toBe("guest");
    expect(h.tables.user.filter((row) => row["email"] === "ada@example.com")).toHaveLength(1);
  });

  test("[account:guest-secures-the-life] given a proof, when the life starts a millisecond before 30 minutes, then it is kept; at 30 minutes it has expired, is deleted and the life is a plain guest", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const states: string[] = [];
    for (const [email, late] of [["on-time@example.com", -1], ["late@example.com", 0]] as const) {
      vi.setSystemTime(START);
      const h = harness();
      const jar = await proved(h, email);
      vi.setSystemTime(START + NEW_LIFE_TTL_MS - 2 * time.MINUTE_MS);
      await h.passAge(jar);
      vi.setSystemTime(START + NEW_LIFE_TTL_MS + late);
      const reply = await (await h.startGuest(jar)).json<NameReply>();
      if (!reply.ok) throw new Error(reply.detail);
      states.push(reply.account.state);
      expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);
    }
    expect(states).toEqual(["secured", "guest"]);
  });

  test("[account:guest-secures-the-life] given a proof, when an account takes the address before the life starts, then the life starts as a plain guest and the reply says the email was taken", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const owner = await h.signUp("ada@example.com");
    const reply = await begin(h, jar);
    if (!reply.ok) throw new Error(reply.detail);
    expect(reply.account.state).toBe("guest");
    expect(reply.emailTaken).toBe(true);
    expect(h.tables.user.filter((row) => row["email"] === "ada@example.com").map((row) => row["id"])).toEqual([owner.account]);
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);
  });

  test("[account:guest-secures-the-life] given a browser that already has a life, when a new life's code is typed there, then it is refused and no proof is kept", async () => {
    const h = harness();
    const { jar } = await h.guest();
    const code = await h.codeFor("new@example.com", jar);
    expect(await json(await prove(h, jar, "new@example.com", code))).toMatchObject({ code: "not-possible" });
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX))).toEqual([]);
  });
});
