// Google's return with no life behind it starts one, saved with Google (account:sign-in-without-secret, account:guest-secures-the-life):
// the callback keeps the same proof the code keeps, holding the address Google verified and the Google identity, named by the
// same httpOnly cookie on the callback's own redirect home; the username step's Continue makes the account kept by the email
// with Google joined, so the next Google sign-in opens it.
import type { AccountReply, AgeStatus, NameReply } from "@japacity/api";
import { GOOGLE_NEW_LIFE, NEW_LIFE_PATH } from "@japacity/api";
import { time } from "@japacity/sim";
import { splitSetCookieHeader } from "better-auth/cookies";
import { afterEach, describe, expect, test, vi } from "vitest";

import { NEW_LIFE_COOKIE, NEW_LIFE_PREFIX, NEW_LIFE_TTL_MS } from "../account/newlife";
import { TURNSTILE_TEST } from "../account/turnstile";
import { googleCallback, harness, makeJar, SITE, withGoogle } from "../auth/auth.testing";
import type { GoogleIdentity, Harness, Jar } from "../auth/auth.testing";
import { banIdentities, emailIdentity } from "../moderation/identities";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const START = Date.parse("2026-10-28T09:00:00Z");
const ADA: GoogleIdentity = { sub: "google-ada", email: "ada@example.com" };

async function json(reply: Response): Promise<Record<string, unknown>> {
  return reply.json<Record<string, unknown>>();
}

/** The username step's Continue from the jar's browser: the guest start marked as one that came by a proof. */
function cont(h: Harness, jar: Jar, username = "kept_one"): Promise<Response> {
  return h.call("/api/guest", { method: "POST", jar, headers: { "x-captcha-response": TURNSTILE_TEST.dummyToken }, json: { username, proved: true } });
}

/** Google's round trip from a browser with no life: the jar ends holding Google's proof. */
async function provedByGoogle(h: Harness, identity: GoogleIdentity = ADA, jar: Jar = makeJar()): Promise<Jar> {
  const back = await withGoogle(h, jar, identity);
  if (back.searchParams.get("error") !== GOOGLE_NEW_LIFE) throw new Error(`Google came back with ${back.search}`);
  return jar;
}

function proofs(h: Harness): Record<string, unknown>[] {
  return h.tables.verification.filter((row) => String(row["identifier"]).startsWith(NEW_LIFE_PREFIX));
}

function googleRows(h: Harness): Record<string, unknown>[] {
  return h.tables.account.filter((row) => row["providerId"] === "google");
}

async function ageStatus(h: Harness, jar: Jar): Promise<AgeStatus> {
  return (await h.call("/api/age", { jar })).json<AgeStatus>();
}

describe("Google's return with no life", () => {
  test("[account:sign-in-without-secret] [account:guest-secures-the-life] given a Google account with a verified address and no life, when its callback runs signed out, then the real redirect home carries the new life's error and sets the proof's httpOnly cookie, the proof holds the address and the identity, and nothing is made", async () => {
    const h = harness();
    const jar = makeJar();
    const back = await googleCallback(h, jar, ADA);
    expect(back.status).toBe(302);
    const location = new URL(back.headers.get("location") ?? "", SITE);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("error")).toBe(GOOGLE_NEW_LIFE);
    const line = splitSetCookieHeader(back.headers.get("set-cookie") ?? "").find((cookie) => cookie.startsWith(`${NEW_LIFE_COOKIE}=`)) ?? "";
    const nonce = line.split(";")[0]?.slice(NEW_LIFE_COOKIE.length + 1) ?? "";
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(line).toMatch(/;\s*HttpOnly/i);
    expect(line).toMatch(/;\s*Secure/i);
    expect(line).toMatch(/;\s*SameSite=Lax/i);
    expect(line).toMatch(/;\s*Path=\/api(;|$)/);
    expect(line).toMatch(new RegExp(`;\\s*Max-Age=${String(NEW_LIFE_TTL_MS / 1000)}(;|$)`, "i"));
    expect(back.headers.get("location")).not.toContain(nonce);
    expect(back.headers.get("location")).not.toContain(ADA.sub);
    expect(proofs(h).map((row) => ({ identifier: row["identifier"], value: JSON.parse(String(row["value"])) as unknown }))).toEqual([{ identifier: NEW_LIFE_PREFIX + nonce, value: { email: ADA.email, google: ADA.sub } }]);
    expect(h.tables.user).toEqual([]);
    expect(h.tables.account).toEqual([]);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
    // The gate on load opens on the new life's steps, in Google's words.
    expect(await ageStatus(h, jar)).toEqual({ refused: false, passed: false, newLife: ADA.email, newLifeBy: "google" });
  });

  test("[account:sign-in-without-secret] given a Google account whose address Google has not verified, when its callback runs signed out, then it answers as before, no-account, with no proof and no cookie", async () => {
    const h = harness();
    const jar = makeJar();
    const back = await withGoogle(h, jar, ADA, { answer: { claims: { email_verified: false }, tokens: { access_token: "google-access" } } });
    expect(back.searchParams.get("error")).toBe("no-account");
    expect(proofs(h)).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(h.tables.user).toEqual([]);
  });

  test("[account:sign-in-without-secret] [moderation:ban-survives-as-hash] given a banned address or a banned Google identity, when Google's callback runs signed out with no life, then each answers as before, with no proof and no cookie", async () => {
    const h = harness();
    await banIdentities(h.deps, [emailIdentity("banned@example.com"), "google:google-banned"]);
    const byEmail = makeJar();
    expect((await withGoogle(h, byEmail, { sub: "google-other", email: "banned@example.com" })).searchParams.get("error")).toBe("not-possible");
    const byIdentity = makeJar();
    expect((await withGoogle(h, byIdentity, { sub: "google-banned", email: "fresh@example.com" })).searchParams.get("error")).toBe("no-account");
    expect(proofs(h)).toEqual([]);
    expect(byEmail.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(byIdentity.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(h.tables.user).toEqual([]);
  });

  test("[account:guest-secures-the-life] given an address an account uses, when Google with that verified address comes back signed out, then it joins that account by the address and signs in, keeping no proof", async () => {
    const h = harness();
    const owner = await h.signUp(ADA.email);
    const jar = makeJar();
    const back = await withGoogle(h, jar, ADA);
    expect(back.searchParams.get("error")).toBeNull();
    expect(proofs(h)).toEqual([]);
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: owner.account, ways: { google: ADA.email, email: ADA.email } } });
  });

  test("[account:sign-in-without-secret] given Google cancelled at its own screen, when the callback comes back with access_denied, then the error is passed on unchanged and no proof is kept", async () => {
    const h = harness();
    const jar = makeJar();
    const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, json: { provider: "google", callbackURL: "/?google=in", errorCallbackURL: "/" } });
    const state = new URL(String((await start.json<{ url: string }>()).url)).searchParams.get("state") ?? "";
    const back = await h.call(`/api/auth/callback/google?error=access_denied&state=${state}`, { jar });
    expect(new URL(back.headers.get("location") ?? "", SITE).searchParams.get("error")).toBe("access_denied");
    expect(proofs(h)).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
  });
});

describe("Continue with Google's proof", () => {
  test("[account:sign-in-without-secret] [account:guest-secures-the-life] given Google's proof and an age pass, when Continue sends the username, then one account is made secured by the email, confirmed, with Google joined and no tokens, and the next Google sign-in from another browser opens it", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    await h.passAge(jar);
    const reply = await (await cont(h, jar, "olamide")).json<NameReply>();
    if (!reply.ok) throw new Error(`Continue was refused: ${reply.detail}`);
    expect(reply.account).toMatchObject({ state: "secured", character: null, username: "olamide", ways: { google: ADA.email, email: ADA.email, passkeys: 0 } });
    expect(h.tables.user).toHaveLength(1);
    expect(h.tables.user[0]).toMatchObject({ id: reply.account.id, email: ADA.email, emailVerified: true, isAnonymous: false });
    expect(googleRows(h)).toHaveLength(1);
    expect(googleRows(h)[0]).toMatchObject({ userId: reply.account.id, accountId: ADA.sub, idToken: null, accessToken: null, refreshToken: null });
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(proofs(h)).toEqual([]);
    // No code is sent on Google's way.
    expect(h.sent).toEqual([]);
    const day = time.dayName(time.utcDay(h.deps.now()));
    const secured = (await h.deps.stores.counters.days(day, day)).filter((row) => row.name === "players/secured");
    expect(secured.reduce((sum, row) => sum + row.count, 0)).toBe(1);
    // Another browser after Continue: Google signs straight in to the same account, with no character, so the door opens there.
    const other = makeJar();
    const back = await withGoogle(h, other, ADA);
    expect(back.searchParams.get("error")).toBeNull();
    expect(back.searchParams.get("google")).toBe("in");
    expect(await (await h.call("/api/account", { jar: other })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: reply.account.id, character: null } });
    expect(h.tables.user).toHaveLength(1);
    expect(googleRows(h)).toHaveLength(1);
  });

  test("[account:sign-in-without-secret] given Google's proof, when it runs out before Continue, then Continue answers proof-gone, spends no age pass and makes nothing, and a fresh trip to Google makes a new proof that Continue goes on with", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const jar = await provedByGoogle(h);
    vi.setSystemTime(START + NEW_LIFE_TTL_MS - 2 * time.MINUTE_MS);
    await h.passAge(jar);
    vi.setSystemTime(START + NEW_LIFE_TTL_MS);
    const gone = await cont(h, jar);
    expect(gone.status).toBe(403);
    expect(await json(gone)).toMatchObject({ code: "proof-gone" });
    expect(h.tables.user).toEqual([]);
    expect(h.sent).toEqual([]);
    expect(await ageStatus(h, jar)).toEqual({ refused: false, passed: true });
    await provedByGoogle(h, ADA, jar);
    expect(await ageStatus(h, jar)).toEqual({ refused: false, passed: true, newLife: ADA.email, newLifeBy: "google" });
    const again = await cont(h, jar);
    expect(await again.json()).toMatchObject({ ok: true, account: { state: "secured", ways: { google: ADA.email, email: ADA.email } } });
  });

  test("[account:sign-in-without-secret] given Google's proof, when the Google row cannot be written at Continue (the identity joined elsewhere in the same instant), then the account stands saved by the email and the reply is the made account, never an error", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    await h.passAge(jar);
    const internal = (await h.auth.$context).internalAdapter;
    const write = internal.createAccount.bind(internal);
    internal.createAccount = () => Promise.reject(new Error("unique violation"));
    const made = await cont(h, jar);
    internal.createAccount = write;
    expect(made.status).toBe(200);
    expect(await made.json()).toMatchObject({ ok: true, account: { state: "secured", ways: { google: null, email: ADA.email } } });
    expect(h.tables.user).toHaveLength(1);
    expect(googleRows(h)).toEqual([]);
  });

  test("[account:sign-in-without-secret] given Google's proof in two browsers, when one continues, then the other's Continue is refused taken and its next Google sign-in opens the one account", async () => {
    const h = harness();
    const here = await provedByGoogle(h);
    const there = await provedByGoogle(h);
    expect(proofs(h)).toHaveLength(2);
    expect(h.tables.user).toEqual([]);
    await h.passAge(there);
    const made = await (await cont(h, there, "there_one")).json<NameReply>();
    if (!made.ok) throw new Error(made.detail);
    await h.passAge(here);
    const refused = await cont(h, here, "here_one");
    expect(refused.status).toBe(409);
    expect(await json(refused)).toMatchObject({ code: "taken" });
    expect(h.tables.user).toHaveLength(1);
    expect((await withGoogle(h, here, ADA)).searchParams.get("google")).toBe("in");
    expect(await (await h.call("/api/account", { jar: here })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: made.account.id } });
  });

  test("[account:sign-in-without-secret] given Google's proof, when an account takes the address before Continue, then Continue is refused taken, no plain guest is made, and Google signs in to that account", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    const owner = await h.signUp(ADA.email);
    await h.passAge(jar);
    const users = h.tables.user.length;
    const reply = await cont(h, jar);
    expect(reply.status).toBe(409);
    expect(await json(reply)).toMatchObject({ code: "taken" });
    expect(h.tables.user).toHaveLength(users);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
    expect((await withGoogle(h, jar, ADA)).searchParams.get("error")).toBeNull();
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: owner.account } });
  });

  test("[account:sign-in-without-secret] given Google's proof, when the Google identity is joined to another account before Continue, then Continue is refused taken and no account or second Google row is made", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    const other = await h.signUp("other@example.com");
    const internal = (await h.auth.$context).internalAdapter;
    await internal.createAccount({ userId: other.account, providerId: "google", accountId: ADA.sub });
    await h.passAge(jar);
    const users = h.tables.user.length;
    const reply = await cont(h, jar);
    expect(reply.status).toBe(409);
    expect(await json(reply)).toMatchObject({ code: "taken" });
    expect(h.tables.user).toHaveLength(users);
    expect(googleRows(h).map((row) => row["userId"])).toEqual([other.account]);
  });

  test("[account:sign-in-without-secret] [moderation:ban-survives-as-hash] given Google's proof, when the Google identity is banned before Continue, then Continue is refused and nothing is made", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    await banIdentities(h.deps, [`google:${ADA.sub}`]);
    await h.passAge(jar);
    const reply = await cont(h, jar);
    expect(reply.status).toBe(403);
    expect(await json(reply)).toMatchObject({ code: "not-possible" });
    expect(h.tables.user).toEqual([]);
    expect(h.tables.account).toEqual([]);
  });

  test("[account:sign-in-without-secret] [account:age-screen-refuses-minors] given Google's proof, when the age screen refuses a minor, then the proof goes with its cookie and nothing is made", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    const refused = await h.passAge(jar, { dateOfBirth: "2015-01-01" });
    expect(refused.status).toBe(403);
    expect(proofs(h)).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    expect(h.tables.user).toEqual([]);
    expect(h.tables.account).toEqual([]);
  });

  test("[account:sign-in-without-secret] given Google's proof, when Use another way drops it, then its row and cookie go and Continue answers proof-gone", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    expect((await h.call(NEW_LIFE_PATH, { method: "DELETE", jar })).status).toBe(200);
    expect(proofs(h)).toEqual([]);
    expect(jar.cookies.has(NEW_LIFE_COOKIE)).toBe(false);
    await h.passAge(jar);
    expect(await json(await cont(h, jar))).toMatchObject({ code: "proof-gone" });
    expect(h.tables.user).toEqual([]);
  });

  test("[account:guest-secures-the-life] given Google's proof, when Begin on Play's start makes the life in that browser, then it is born secured by the address with Google joined", async () => {
    const h = harness();
    const jar = await provedByGoogle(h);
    await h.passAge(jar);
    const reply = await (await h.startGuest(jar)).json<NameReply>();
    if (!reply.ok) throw new Error(reply.detail);
    expect(reply.account).toMatchObject({ state: "secured", ways: { google: ADA.email, email: ADA.email } });
    expect(googleRows(h).map((row) => row["userId"])).toEqual([reply.account.id]);
  });
});

describe("a guest keeping its life with Google", () => {
  test("[account:guest-secures-the-life] given a signed-in guest, when Google with no life comes back, then the guest's life is kept with Google as before and no proof is kept", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const back = await withGoogle(h, jar, ADA, { callbackURL: "/?google=kept" });
    expect(back.searchParams.get("google")).toBe("kept");
    expect(proofs(h)).toEqual([]);
    expect(await (await h.call("/api/account", { jar })).json<AccountReply>()).toMatchObject({ ok: true, account: { id: account, state: "secured", ways: { google: ADA.email } } });
  });
});
