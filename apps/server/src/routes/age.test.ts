import { describe, expect, test } from "vitest";

import { PASS_COOKIE, PASS_PREFIX, REFUSED_COOKIE } from "../account/age";
import { TURNSTILE_TEST } from "../account/turnstile";
import { harness, makeJar } from "../auth/testing";
import type { Harness, Jar } from "../auth/testing";
import { productionConfig } from "../config";

const DAY_S = 86_400;

/** The calendar date `years` years before today, in UTC, shifted by `days`. */
function bornYearsAgo(years: number, days = 0): string {
  const today = new Date();
  const date = new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate() + days));
  return date.toISOString().slice(0, 10);
}

async function trySignIn(h: Harness, email: string, jar: Jar, country = "NG") {
  const otp = await h.codeFor(email, jar);
  return h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, country, json: { email, otp } });
}

describe("POST /api/age", () => {
  test("[R-ACCOUNT-012] given a player who is the least age exactly today, when the screen is sent, then it passes and sets a single-use pass", async () => {
    const h = harness();
    const jar = makeJar();
    const reply = await h.passAge(jar, { dateOfBirth: bornYearsAgo(h.deps.config.account.minAge) });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ ok: true });
    expect(jar.cookies.has(PASS_COOKIE)).toBe(true);
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(PASS_PREFIX))).toHaveLength(1);
  });

  test("[R-ACCOUNT-012] given a player one day short of the least age, when the screen is sent, then it is refused with a cookie that lasts the refusal days", async () => {
    const h = harness();
    const jar = makeJar();
    const reply = await h.passAge(jar, { dateOfBirth: bornYearsAgo(h.deps.config.account.minAge, 1) });
    expect(reply.status).toBe(403);
    expect(await reply.json()).toMatchObject({ ok: false, code: "under-age" });
    const cookie = reply.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${REFUSED_COOKIE}=1`);
    expect(cookie).toContain(`Max-Age=${String(productionConfig.account.refusedCookieDays * DAY_S)}`);
    expect(jar.cookies.has(PASS_COOKIE)).toBe(false);
    expect(h.tables.verification).toHaveLength(0);
  });

  test("[R-ACCOUNT-012] given a browser refused once, when it sends an adult's date, then it is refused again without the date being judged", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar, { dateOfBirth: bornYearsAgo(10) });
    const again = await h.passAge(jar, { dateOfBirth: "1980-01-01" });
    expect(again.status).toBe(403);
    expect(await again.json()).toMatchObject({ code: "under-age" });
    const nonsense = await h.call("/api/age", { method: "POST", jar, json: { dateOfBirth: "not a date" } });
    expect(await nonsense.json()).toMatchObject({ code: "under-age" });
    expect(jar.cookies.has(PASS_COOKIE)).toBe(false);
  });

  test("[R-ACCOUNT-012] given a date that is not real or not believable, when the screen is sent, then it is refused as a bad date and nothing is kept", async () => {
    const h = harness();
    for (const dateOfBirth of ["2008-02-30", "2999-01-01", "1850-01-01", ""]) {
      const reply = await h.passAge(makeJar(), { dateOfBirth });
      expect(reply.status).toBe(400);
      expect(await reply.json()).toMatchObject({ code: "bad-date" });
    }
    expect(h.tables.verification).toHaveLength(0);
  });

  test("[R-ACCOUNT-020] given a passed screen and a new account, when every store and table is read, then the date of birth is nowhere", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const everything = JSON.stringify({ tables: h.tables, row: await h.deps.stores.account.get(account) });
    expect(everything).not.toContain("1990-05-17");
  });

  test("[R-ACCOUNT-011] given a closed region, when the screen is sent, then it is refused with region-closed before the date is read and nothing is kept", async () => {
    const h = harness();
    const jar = makeJar();
    const reply = await h.call("/api/age", { method: "POST", jar, country: "AU", json: { dateOfBirth: "not even a date" } });
    expect(reply.status).toBe(403);
    expect(await reply.json()).toMatchObject({ ok: false, code: "region-closed" });
    expect(reply.headers.get("set-cookie")).toBeNull();
    expect(h.tables.verification).toHaveLength(0);
  });

  test("[R-ACCOUNT-011] given a pass from an open region, when the account is made from a closed one, then it is refused with region-closed and no account exists", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar, { country: "NG" });
    const reply = await trySignIn(h, "ada@example.com", jar, "AU");
    expect(reply.status).toBe(403);
    expect(await reply.json()).toMatchObject({ code: "region-closed" });
    expect(h.tables.user).toHaveLength(0);
  });

  test("[R-ACCOUNT-008] given the codes XX and T1, when a player signs up, then the unknown row lets them in and the code is stored", async () => {
    const h = harness();
    for (const [country, email] of [["XX", "x@example.com"], ["T1", "t@example.com"]] as const) {
      const { account } = await h.signUp(email, makeJar(), country);
      expect((await h.deps.stores.account.get(account))?.country).toBe(country);
    }
  });
});

describe("the bot check at sign-up", () => {
  test("[R-ACCOUNT-013] given Turnstile's always-pass test secret and its dummy token, when the screen is sent, then it passes", async () => {
    const h = harness({ turnstileSecret: TURNSTILE_TEST.passSecret });
    expect((await h.passAge(makeJar(), { token: TURNSTILE_TEST.dummyToken })).status).toBe(200);
  });

  test("[R-ACCOUNT-013] given a missing, failed or spent token, when the screen is sent, then no pass is given and the sign-in makes no account", async () => {
    const cases = [
      { secret: TURNSTILE_TEST.passSecret, token: "" },
      { secret: TURNSTILE_TEST.failSecret, token: TURNSTILE_TEST.dummyToken },
      { secret: TURNSTILE_TEST.spentSecret, token: TURNSTILE_TEST.dummyToken },
    ];
    for (const { secret, token } of cases) {
      const h = harness({ turnstileSecret: secret });
      const jar = makeJar();
      const reply = await h.passAge(jar, { token });
      expect(reply.status).toBe(403);
      expect(await reply.json()).toMatchObject({ code: "bot-check" });
      expect(jar.cookies.has(PASS_COOKIE)).toBe(false);
      const signIn = await trySignIn(h, "ada@example.com", jar);
      expect(signIn.status).toBe(403);
      expect(await signIn.json()).toMatchObject({ code: "no-age-pass" });
      expect(h.tables.user).toHaveLength(0);
      expect(await h.deps.stores.account.get("anything")).toBeNull();
    }
  });

  test("[R-ACCOUNT-013] given one pass, when two accounts are made with it, then the second is refused", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    expect((await trySignIn(h, "first@example.com", jar)).status).toBe(200);
    const second = await trySignIn(h, "second@example.com", jar);
    expect(second.status).toBe(403);
    expect(h.tables.user).toHaveLength(1);
  });

  test("[R-ACCOUNT-013] given an account, when it signs in again with no pass and no token, then no bot check is asked", async () => {
    const h = harness();
    await h.signUp("ada@example.com");
    const fresh = makeJar();
    const reply = await trySignIn(h, "ada@example.com", fresh);
    expect(reply.status).toBe(200);
    expect(h.tables.user).toHaveLength(1);
  });
});
