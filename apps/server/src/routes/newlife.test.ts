// One code, sent to every address alike, that signs in or proves the address for a new life (account:sign-in-without-secret,
// account:guest-secures-the-life, account:email-code-is-short-lived): the send that answers every address the same, the code
// check that signs in or keeps a proof, and the guest start by the code that consumes the proof.
import type { AccountReply, AgeStatus, NameReply } from "@japacity/api";
import { NEW_LIFE_PATH } from "@japacity/api";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { NEW_LIFE_COOKIE, NEW_LIFE_PREFIX, NEW_LIFE_TTL_MS } from "../account/newlife";
import { TURNSTILE_TEST } from "../account/turnstile";
import { harness, makeJar, withGoogle } from "../auth/auth.testing";
import type { Harness, Jar } from "../auth/auth.testing";
import { memoryStores } from "../dependencies";
import { banIdentities, emailIdentity } from "../moderation/identities";
import { setSwitch } from "../switches/switches";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const START = Date.parse("2026-10-28T09:00:00Z");
const CODE_CHECK = "/api/auth/sign-in/email-otp";

async function json(reply: Response): Promise<Record<string, unknown>> {
  return reply.json<Record<string, unknown>>();
}

/** A send of a sign-in code from the jar's browser. */
function send(h: Harness, jar: Jar, email: string, ip?: string): Promise<Response> {
  return h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", jar, ...(ip === undefined ? {} : { ip }), json: { email, type: "sign-in" } });
}

/** The code typed on the ways back in, from the jar's browser. */
function check(h: Harness, jar: Jar, email: string, otp: string, ip?: string): Promise<Response> {
  return h.call(CODE_CHECK, { method: "POST", jar, ...(ip === undefined ? {} : { ip }), json: { email, otp } });
}

/** A code sent and typed for an address no account uses: the jar ends holding the proof. */
async function proved(h: Harness, email: string, jar: Jar = makeJar(), ip?: string): Promise<Jar> {
  const code = await h.codeFor(email, jar, ip);
  const reply = await check(h, jar, email, code, ip);
  if (reply.status !== 200) throw new Error(`The code check answered ${String(reply.status)}: ${await reply.text()}`);
  return jar;
}

/** The username step's Continue from the jar's browser: the guest start marked as one that came by the code. */
function cont(h: Harness, jar: Jar, username = "kept_one"): Promise<Response> {
  return h.call("/api/guest", { method: "POST", jar, headers: { "x-captcha-response": TURNSTILE_TEST.dummyToken }, json: { username, proved: true } });
}

/** The age screen and Begin on Play's start from the jar's browser; the guest start's reply. */
async function begin(h: Harness, jar: Jar): Promise<NameReply> {
  await h.passAge(jar);
  return (await h.startGuest(jar)).json<NameReply>();
}

function proofs(h: Harness): Record<string, unknown>[] {
  return h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX));
}

function userOf(h: Harness, id: string): Record<string, unknown> | undefined {
  return h.tables.user.find((row) => row["id"] === id);
}

async function ageStatus(h: Harness, jar: Jar): Promise<AgeStatus> {
  return (await h.call("/api/age", { jar })).json<AgeStatus>();
}

describe("the send answers every address alike", () => {
  test("[account:sign-in-without-secret] [account:email-code-is-short-lived] given one address an account uses and one no account uses, when a code is asked for each signed out, then both answer the same status and body and a code is mailed to each", async () => {
    const h = harness();
    await h.signUp("ada@example.com");
    const sent = h.sent.length;
    const behind = h.background.length;
    const known = await send(h, makeJar(), "Ada@Example.com", "198.51.100.1");
    const unknown = await send(h, makeJar(), "nobody@example.com", "198.51.100.2");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(known.status);
    expect(await unknown.text()).toBe(await known.text());
    expect(h.sent.slice(sent).map((message) => message.email)).toEqual(["ada@example.com", "nobody@example.com"]);
    expect(h.sent.slice(sent).every((message) => /^\d{6}$/.test(message.otp))).toBe(true);
    // The reply never waited on either mail: both went to the background alike.
    expect(h.background).toHaveLength(behind + 2);
  });

  test("[account:sign-in-without-secret] [moderation:ban-survives-as-hash] given a banned address, when a code is asked for it, then it answers as every other address and nothing is mailed", async () => {
    const h = harness();
    await banIdentities(h.deps, [emailIdentity("bad@example.com")]);
    const banned = await send(h, makeJar(), "bad@example.com", "198.51.100.3");
    const other = await send(h, makeJar(), "fine@example.com", "198.51.100.4");
    expect(banned.status).toBe(other.status);
    expect(await banned.text()).toBe(await other.text());
    expect(h.sent.map((message) => message.email)).toEqual(["fine@example.com"]);
  });

  test("[account:sign-in-without-secret] [account:sign-in-routes-rate-limited] given sends from one address to addresses no account uses, when one more than the limit is sent in 60 seconds, then it is refused by the limit as any send is, and each one under it is mailed", async () => {
    const h = harness();
    const limit = h.deps.config.auth.limits.otpSendPer60s;
    const statuses: number[] = [];
    for (let n = 0; n <= limit; n++) statuses.push((await send(h, makeJar(), `nobody-${String(n)}@example.com`, "198.51.100.5")).status);
    expect(statuses).toEqual([...Array.from({ length: limit }, () => 200), 429]);
    expect(h.sent).toHaveLength(limit);
  });

  test("[account:sign-in-without-secret] [account:sign-in-routes-rate-limited] given sends to one address no account uses from many places, when one more than the per-email limit is sent in 60 seconds, then it is refused as for an address an account uses", async () => {
    const h = harness();
    const limit = h.deps.config.auth.limits.otpSendPer60s;
    const statuses: number[] = [];
    for (let n = 0; n <= limit; n++) statuses.push((await send(h, makeJar(), "nobody@example.com", `198.51.100.${String(20 + n)}`)).status);
    expect(statuses).toEqual([...Array.from({ length: limit }, () => 200), 429]);
  });

  test("[account:guest-secures-the-life] given a guest keeping its life, when it sends a code to an address an account uses, then the code is sent, and only the right code tells it the address is taken", async () => {
    const h = harness();
    await h.signUp("ada@example.com");
    const { jar, account } = await h.guest();
    const sent = h.sent.length;
    const reply = await send(h, jar, "ada@example.com");
    expect(reply.status).toBe(200);
    expect(h.sent.slice(sent).map((message) => message.email)).toEqual(["ada@example.com"]);
    const otp = h.sent.at(-1)?.otp ?? "";
    const wrong = otp === "000000" ? "111111" : "000000";
    expect(await json(await check(h, jar, "ada@example.com", wrong))).toMatchObject({ code: "INVALID_OTP" });
    expect(await json(await check(h, jar, "ada@example.com", otp))).toMatchObject({ code: "method-taken" });
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: account, state: "guest" } });
  });
});

describe("the right code signs in or proves the address", () => {
  test("[account:sign-in-without-secret] [account:guest-secures-the-life] given an address no account uses, when its right code is checked signed out, then it answers new-life, spends the code, keeps a proof holding the address alone for 30 minutes and names it only in an httpOnly cookie, and makes nothing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const jar = makeJar();
    const code = await h.codeFor("Ada@Example.com", jar);
    const reply = await check(h, jar, "Ada@Example.com", code);
    expect(reply.status).toBe(200);
    expect(await json(reply)).toEqual({ next: "new-life" });
    // The code is gone: the same code proves nothing again, and is refused as any spent code is.
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith("sign-in-otp-"))).toEqual([]);
    const again = await check(h, makeJar(), "ada@example.com", code, "198.51.100.6");
    expect(again.status).toBe(400);
    expect(await json(again)).toMatchObject({ code: "INVALID_OTP" });
    expect(proofs(h)).toHaveLength(1);
    expect(proofs(h)[0]?.["value"]).toBe("ada@example.com");
    expect(new Date(String(proofs(h)[0]?.["expiresAt"])).getTime()).toBe(START + NEW_LIFE_TTL_MS);
    const cookie = reply.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${NEW_LIFE_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api(;|$)/);
    expect(cookie).toContain(`Max-Age=${String(NEW_LIFE_TTL_MS / 1000)}`);
    expect(String(proofs(h)[0]?.["identifier"])).toBe(NEW_LIFE_PREFIX + (jar.cookies.get(NEW_LIFE_COOKIE) ?? "missing"));
    expect(h.tables.user).toEqual([]);
    expect(h.tables.session).toEqual([]);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
  });

  test("[account:sign-in-without-secret] [account:email-code-is-short-lived] given one address an account uses and one no account uses, when wrong codes up to the tries, the right one after them and a code run out are checked for each, then each answer is the same for both", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    await h.signUp("ada@example.com");
    const tries = h.deps.config.auth.otp.attempts;
    const said = async (email: string, ip: string): Promise<string[]> => {
      const jar = makeJar();
      vi.setSystemTime(START + time.MINUTE_MS);
      const code = await h.codeFor(email, jar, ip);
      const wrong = code === "000000" ? "111111" : "000000";
      const out: string[] = [];
      const answer = async (otp: string, at: string) => {
        const reply = await check(h, jar, email, otp, at);
        out.push(`${String(reply.status)} ${await reply.text()}`);
      };
      for (let n = 0; n < tries; n++) await answer(wrong, `${ip}${String(n)}`);
      await answer(code, `${ip}9`);
      vi.setSystemTime(START + 2 * time.MINUTE_MS);
      const late = await h.codeFor(email, jar, ip);
      vi.setSystemTime(START + 2 * time.MINUTE_MS + h.deps.config.auth.otp.expiresIn * 1000 + 1);
      await answer(late, `${ip}8`);
      return out;
    };
    const known = await said("ada@example.com", "198.51.100.1");
    const unknown = await said("nobody@example.com", "198.51.100.2");
    expect(unknown).toEqual(known);
    expect(known.map((line) => line.split(" ")[0])).toEqual([...Array.from({ length: tries }, () => "400"), "403", "400"]);
    expect(proofs(h)).toEqual([]);
  });

  test("[account:sign-in-without-secret] given an address an account uses, when its right code is checked signed out, then it signs in to that account as ever and keeps no proof", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const jar = makeJar();
    const code = await h.codeFor("ada@example.com", jar, "198.51.100.30");
    const reply = await check(h, jar, "ada@example.com", code, "198.51.100.30");
    expect(reply.status).toBe(200);
    expect(await json(reply)).toMatchObject({ user: { id: account } });
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(proofs(h)).toEqual([]);
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: account } });
  });

  test("[account:sign-in-without-secret] [moderation:ban-survives-as-hash] given an address banned after its code was sent, when the right code is checked, then it is refused as a wrong code and no proof is kept", async () => {
    const h = harness();
    const jar = makeJar();
    const code = await h.codeFor("bad@example.com", jar, "198.51.100.31");
    await banIdentities(h.deps, [emailIdentity("bad@example.com")]);
    const reply = await check(h, jar, "bad@example.com", code, "198.51.100.31");
    expect(reply.status).toBe(400);
    expect(await json(reply)).toMatchObject({ code: "INVALID_OTP" });
    expect(proofs(h)).toEqual([]);
  });

  test("[account:sign-in-without-secret] given an account that was deleted, when its address is sent a code and the right code is checked, then the address is proved for a new life as any address no account uses", async () => {
    const h = harness();
    const { jar } = await h.signUp("ada@example.com");
    expect((await h.call("/api/account", { method: "DELETE", jar, ip: "192.0.2.60" })).status).toBe(200);
    const again = await proved(h, "ada@example.com", makeJar(), "192.0.2.61");
    expect(proofs(h).map((row) => row["value"])).toEqual(["ada@example.com"]);
    await h.passAge(again);
    const made = await cont(h, again, "back_again");
    expect(made.status).toBe(200);
    expect(await made.json()).toMatchObject({ ok: true, account: { state: "secured", ways: { email: "ada@example.com" } } });
  });
});

describe("the life that came by the code, started at the username", () => {
  test("[account:sign-in-without-secret] [account:guest-secures-the-life] given a proof and an age pass, when Continue sends the username, then the account is made secured by the email, confirmed, with no character, signed in here and found by the email from another browser", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    await h.passAge(jar);
    const reply = await (await cont(h, jar, "olamide")).json<NameReply>();
    if (!reply.ok) throw new Error(`Continue was refused: ${reply.detail}`);
    expect(reply.account).toMatchObject({ state: "secured", character: null, username: "olamide", ways: { google: null, email: "ada@example.com", passkeys: 0 } });
    expect(userOf(h, reply.account.id)).toMatchObject({ email: "ada@example.com", emailVerified: true, isAnonymous: false });
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(proofs(h)).toEqual([]);
    // No second code: the one that proved the address is the only one sent.
    expect(h.sent).toHaveLength(1);
    // The same marks as a guest that kept its life by the code.
    const day = time.dayName(time.utcDay(h.deps.now()));
    const secured = (await h.deps.stores.counters.days(day, day)).filter((row) => row.name === "players/secured");
    expect(secured.reduce((sum, row) => sum + row.count, 0)).toBe(1);
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: reply.account.id, character: null } });
    // Another browser signs in with the email and finds the same account, with no character, so the door opens there too.
    const other = makeJar();
    const otp = await h.codeFor("ada@example.com", other, "198.51.100.40");
    const back = await check(h, other, "ada@example.com", otp, "198.51.100.40");
    expect(back.status).toBe(200);
    expect(await (await h.call("/api/account", { jar: other })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: reply.account.id, character: null } });
    expect(h.tables.user).toHaveLength(1);
  });

  test("[account:sign-in-without-secret] given a proof made in one browser, when another browser continues with it, even with the cookie copied after its use, then it is told the proof is gone and nothing is made", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const nonce = jar.cookies.get(NEW_LIFE_COOKIE) ?? "";
    const elsewhere = makeJar();
    await h.passAge(elsewhere);
    const there = await cont(h, elsewhere, "elsewhere_one");
    expect(there.status).toBe(403);
    expect(await json(there)).toMatchObject({ code: "proof-gone" });
    expect(h.tables.user).toEqual([]);
    await h.passAge(jar);
    expect((await cont(h, jar)).status).toBe(200);
    const copied = makeJar();
    copied.cookies.set(NEW_LIFE_COOKIE, nonce);
    await h.passAge(copied);
    expect(await json(await cont(h, copied, "copied_one"))).toMatchObject({ code: "proof-gone" });
    expect(h.tables.user).toHaveLength(1);
  });

  /** A proof made at START, the age passed two minutes before it runs out, and Continue `at` from START. */
  async function continuedAt(at: number, email: string): Promise<{ h: Harness; jar: Jar; reply: Response }> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const jar = await proved(h, email);
    vi.setSystemTime(START + NEW_LIFE_TTL_MS - 2 * time.MINUTE_MS);
    await h.passAge(jar);
    vi.setSystemTime(START + at);
    return { h, jar, reply: await cont(h, jar) };
  }

  test("[account:sign-in-without-secret] given a proof, when Continue comes a millisecond before 30 minutes, then the account is made", async () => {
    const { reply } = await continuedAt(NEW_LIFE_TTL_MS - 1, "on-time@example.com");
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ ok: true, account: { state: "secured", ways: { email: "on-time@example.com" } } });
  });

  test("[account:sign-in-without-secret] given a proof, when Continue comes at 30 minutes, then it answers proof-gone, makes nothing and spends no age pass, and a new right code lets Continue go on", async () => {
    const { h, jar, reply } = await continuedAt(NEW_LIFE_TTL_MS, "late@example.com");
    expect(reply.status).toBe(403);
    expect(await json(reply)).toMatchObject({ code: "proof-gone" });
    expect(h.tables.user).toEqual([]);
    expect((await ageStatus(h, jar)).passed).toBe(true);
    // A new code, a fresh proof, and Continue goes on under the age pass still held.
    await proved(h, "late@example.com", jar);
    const again = await cont(h, jar);
    expect(await again.json()).toMatchObject({ ok: true, account: { state: "secured", ways: { email: "late@example.com" } } });
  });

  test("[account:sign-in-without-secret] given a proof, when an account takes the address before Continue, then Continue is refused taken and no plain guest is made", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    // Kept with Google meanwhile, so no code replaces anything.
    const owner = await h.guest();
    expect((await withGoogle(h, owner.jar, { sub: "google-ada", email: "ada@example.com" })).searchParams.get("error")).toBeNull();
    await h.passAge(jar);
    const users = h.tables.user.length;
    const reply = await cont(h, jar);
    expect(reply.status).toBe(409);
    expect(await json(reply)).toMatchObject({ code: "taken" });
    expect(h.tables.user).toHaveLength(users);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
  });

  test("[account:sign-in-without-secret] given two tabs on one proof, when both press Continue, then the first makes the account and the second finds this browser signed in, with no second account", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    await h.passAge(jar);
    const first = await (await cont(h, jar, "first_tab")).json<NameReply>();
    if (!first.ok) throw new Error(first.detail);
    const second = await cont(h, jar, "second_tab");
    expect(second.status).toBe(409);
    expect(await json(second)).toMatchObject({ code: "not-possible" });
    expect(h.tables.user).toHaveLength(1);
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: first.account.id } });
  });

  test("[account:sign-in-without-secret] [server:four-off-switches] given a proof, when sign-ups are switched off before Continue, then Continue is told full, the proof is kept, and once they open again within its time Continue goes on", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    await h.passAge(jar);
    await setSwitch(h.deps, "signups", false, "account.owner", "full");
    const full = await cont(h, jar);
    expect(full.status).toBe(503);
    expect(await json(full)).toMatchObject({ code: "switched-off" });
    expect(proofs(h).map((row) => row["value"])).toEqual(["ada@example.com"]);
    expect(h.tables.user).toEqual([]);
    await setSwitch(h.deps, "signups", true, "account.owner", "open");
    const reply = await (await cont(h, jar)).json<NameReply>();
    if (!reply.ok) throw new Error(reply.detail);
    expect(reply.account).toMatchObject({ state: "secured", ways: { email: "ada@example.com" } });
  });

  test("[account:sign-in-without-secret] given a proof, when the age pass is missing at Continue, then it answers that the age must be asked again and the proof stands for the next Continue", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const reply = await cont(h, jar);
    expect(reply.status).toBe(403);
    expect(await json(reply)).toMatchObject({ code: "expired" });
    expect(proofs(h)).toHaveLength(1);
    await h.passAge(jar);
    expect((await cont(h, jar)).status).toBe(200);
  });

  test("[account:sign-in-without-secret] given a right code here, when the address is signed in to from another browser before Continue, then that browser is given its own proof and the same steps, and one Continue makes the one account", async () => {
    const h = harness();
    const here = await proved(h, "ada@example.com", makeJar(), "198.51.100.50");
    const there = await proved(h, "ada@example.com", makeJar(), "198.51.100.51");
    expect(proofs(h)).toHaveLength(2);
    expect(h.tables.user).toEqual([]);
    await h.passAge(there);
    expect((await cont(h, there, "there_one")).status).toBe(200);
    await h.passAge(here);
    expect(await json(await cont(h, here, "here_one"))).toMatchObject({ code: "taken" });
    expect(h.tables.user).toHaveLength(1);
  });
});

describe("a proof held by this browser", () => {
  test("[account:sign-in-without-secret] given a live proof, when the age standing is read, then it names the proof's address in this browser alone, and not once the proof has run out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    expect(await ageStatus(h, jar)).toEqual({ refused: false, passed: false, newLife: "ada@example.com" });
    await h.passAge(jar);
    expect(await ageStatus(h, jar)).toEqual({ refused: false, passed: true, newLife: "ada@example.com" });
    expect(await ageStatus(h, makeJar())).toEqual({ refused: false, passed: false });
    vi.setSystemTime(START + NEW_LIFE_TTL_MS);
    expect((await ageStatus(h, jar)).newLife).toBeUndefined();
  });

  test("[account:sign-in-without-secret] given a live proof, when Use another email drops it, then its row and cookie go and Continue answers proof-gone", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const dropped = await h.call(NEW_LIFE_PATH, { method: "DELETE", jar });
    expect(dropped.status).toBe(200);
    expect(proofs(h)).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    await h.passAge(jar);
    expect(await json(await cont(h, jar))).toMatchObject({ code: "proof-gone" });
    expect(h.tables.user).toEqual([]);
  });

  test("[account:sign-in-without-secret] [account:age-screen-refuses-minors] given a live proof, when the age screen refuses a minor, then the proof goes too and nothing is made", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const refused = await h.passAge(jar, { dateOfBirth: "2015-01-01" });
    expect(refused.status).toBe(403);
    expect(proofs(h)).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(h.tables.user).toEqual([]);
  });
});

describe("Play's start with a proof held", () => {
  test("[account:guest-secures-the-life] given a proof, when Begin on Play's start makes the life in that browser, then it is born secured by the address", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const reply = await begin(h, jar);
    if (!reply.ok) throw new Error(`The guest start was refused: ${reply.detail}`);
    expect(reply.account).toMatchObject({ state: "secured", ways: { google: null, email: "ada@example.com", passkeys: 0 } });
    expect(reply.emailTaken).toBeUndefined();
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(proofs(h)).toEqual([]);
  });

  test("[account:guest-secures-the-life] given no proof, then the life starts as a plain guest and nothing else changes", async () => {
    const h = harness();
    const reply = await begin(h, makeJar());
    if (!reply.ok) throw new Error(`The guest start was refused: ${reply.detail}`);
    expect(reply.account).toMatchObject({ state: "guest", ways: { google: null, email: null, passkeys: 0 } });
    expect(reply.emailTaken).toBeUndefined();
    expect(userOf(h, reply.account.id)).toMatchObject({ isAnonymous: true });
  });

  test("[account:guest-secures-the-life] given a proof, when an account takes the address before Begin on Play's start, then the life starts as a plain guest and the reply says the email was taken", async () => {
    const h = harness();
    const jar = await proved(h, "ada@example.com");
    const owner = await h.signUp("ada@example.com");
    const reply = await begin(h, jar);
    if (!reply.ok) throw new Error(reply.detail);
    expect(reply.account.state).toBe("guest");
    expect(reply.emailTaken).toBe(true);
    expect(h.tables.user.filter((row) => row["email"] === "ada@example.com").map((row) => row["id"])).toEqual([owner.account]);
    expect(proofs(h)).toEqual([]);
  });

  test("[account:guest-secures-the-life] given a proof, when the guest start is refused after it took the proof (a username taken at the same moment), then the proof is put back as it was and the next Begin with a free name is born kept by the address", async () => {
    const stores = memoryStores();
    const create = stores.account.create;
    let refuseOnce = true;
    // Another player takes the name between the route's check and the row's write.
    stores.account.create = (row) => {
      if (!refuseOnce) return create(row);
      refuseOnce = false;
      return Promise.resolve({ ok: false, code: "conflict", detail: `The username ${row.username} is taken.` });
    };
    const h = harness({ stores });
    const jar = await proved(h, "ada@example.com");
    const before = proofs(h).map((row) => ({ identifier: row["identifier"], value: row["value"], expiresAt: new Date(String(row["expiresAt"])).getTime() }));
    await h.passAge(jar);
    const refused = await h.startGuest(jar, { username: "raced_name" });
    expect(refused.status).toBe(409);
    expect(await json(refused)).toMatchObject({ code: "not-legal", name: "taken" });
    // The proof stands again, the same row, and the browser still holds its cookie.
    expect(proofs(h).map((row) => ({ identifier: row["identifier"], value: row["value"], expiresAt: new Date(String(row["expiresAt"])).getTime() }))).toEqual(before);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(true);
    const reply = await begin(h, jar);
    if (!reply.ok) throw new Error(reply.detail);
    expect(reply.account).toMatchObject({ state: "secured", ways: { email: "ada@example.com" } });
    expect(h.sent).toHaveLength(1);
  });
});
