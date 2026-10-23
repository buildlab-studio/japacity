import { describe, expect, test } from "vitest";

import { PASS_COOKIE, PASS_PREFIX, PASS_TTL_MS, REFUSED_COOKIE } from "../account/age";
import { harness, makeJar } from "../auth/auth.testing";
import { productionConfig } from "../config";

const DAY_S = 86_400;

/** The calendar date `years` years before today, in UTC, shifted by `days`. */
function bornYearsAgo(years: number, days = 0): string {
  const today = new Date();
  const date = new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate() + days));
  return date.toISOString().slice(0, 10);
}

describe("POST /api/age", () => {
  test("[account:age-screen-refuses-minors] given a player who is the least age exactly today, when the screen is sent, then it passes and sets a single-use pass", async () => {
    const h = harness();
    const jar = makeJar();
    const reply = await h.passAge(jar, { dateOfBirth: bornYearsAgo(h.deps.config.account.minAge) });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ ok: true });
    expect(jar.cookies.has(PASS_COOKIE)).toBe(true);
    expect(h.tables.verification.filter((row) => String(row["identifier"]).startsWith(PASS_PREFIX))).toHaveLength(1);
  });

  test("[account:age-screen-refuses-minors] given a player one day short of the least age, when the screen is sent, then it is refused with a cookie that lasts the refusal days", async () => {
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

  test("[account:age-screen-refuses-minors] given a browser refused once, when it sends an adult's date, then it is refused again without the date being judged", async () => {
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

  test("[account:age-screen-refuses-minors] given a date that is not real or not believable, when the screen is sent, then it is refused as a bad date and nothing is kept", async () => {
    const h = harness();
    for (const dateOfBirth of ["2008-02-30", "2999-01-01", "1850-01-01", ""]) {
      const reply = await h.passAge(makeJar(), { dateOfBirth });
      expect(reply.status).toBe(400);
      expect(await reply.json()).toMatchObject({ code: "bad-date" });
    }
    expect(h.tables.verification).toHaveLength(0);
  });

  test("[account:only-needed-data-kept] given a passed screen and a new account, when every store and table is read, then the date of birth is nowhere", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const everything = JSON.stringify({ tables: h.tables, row: await h.deps.stores.account.get(account) });
    expect(everything).not.toContain("1990-05-17");
  });

  test("[account:sign-up-open-everywhere] [account:same-contact-for-everyone] given players in Australia and in France, when each passes the age screen and starts a guest life, then each account is made and keeps its country", async () => {
    const h = harness();
    for (const [country, email] of [["AU", "au@example.com"], ["FR", "fr@example.com"]] as const) {
      const { account } = await h.signUp(email, makeJar(), country);
      expect((await h.deps.stores.account.get(account))?.country).toBe(country);
    }
  });

  test("[account:sign-up-open-everywhere] given a pass from Nigeria, when the guest life is started from Australia, then the account is made", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar, { country: "NG" });
    const reply = await h.startGuest(jar, { country: "AU" });
    expect(reply.status).toBe(200);
    expect(h.tables.user).toHaveLength(1);
  });

  test("[account:country-comes-from-cloudflare] given the codes XX and T1, when a player signs up, then the code is stored", async () => {
    const h = harness();
    for (const [country, email] of [["XX", "x@example.com"], ["T1", "t@example.com"]] as const) {
      const { account } = await h.signUp(email, makeJar(), country);
      expect((await h.deps.stores.account.get(account))?.country).toBe(country);
    }
  });
});

describe("GET /api/age", () => {
  test("[account:age-screen-refuses-minors] given a fresh browser, when the screen's standing is read, then it is not refused", async () => {
    const h = harness();
    const reply = await h.call("/api/age", { jar: makeJar() });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ refused: false, passed: false });
  });

  test("[account:age-screen-refuses-minors] given a passed screen, when the standing is read while the pass holds, then it reports passed, so a reload or Back before Begin does not ask again", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    expect(await (await h.call("/api/age", { jar })).json()).toEqual({ refused: false, passed: true });
  });

  test("[account:age-screen-refuses-minors] given a pass, then its cookie's path covers both the standing and the guest start, so the browser sends it to each", async () => {
    const h = harness();
    const reply = await h.passAge(makeJar());
    const line = (reply.headers.get("set-cookie") ?? "").split(/,(?=\s*[\w-]+=)/).find((cookie) => cookie.trim().startsWith(`${PASS_COOKIE}=`)) ?? "";
    const path = /;\s*Path=([^;]*)/i.exec(line)?.[1] ?? "";
    expect(path).not.toBe("");
    // A cookie's path covers a request whose path is the same or starts with it and a slash (RFC 6265 section 5.1.4).
    const covers = (request: string) => request === path || request.startsWith(path.endsWith("/") ? path : `${path}/`);
    expect(covers("/api/age")).toBe(true);
    expect(covers("/api/guest")).toBe(true);
  });

  test("[account:age-screen-refuses-minors] given the pass spent by the guest start, when the standing is read with the pass cookie still sent, then it is not passed", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const copy = makeJar();
    copy.cookies.set(PASS_COOKIE, jar.cookies.get(PASS_COOKIE) ?? "");
    expect((await h.startGuest(jar)).status).toBe(200);
    expect(await (await h.call("/api/age", { jar })).json()).toEqual({ refused: false, passed: false });
    expect(await (await h.call("/api/age", { jar: copy })).json()).toEqual({ refused: false, passed: false });
  });

  test("[account:age-screen-refuses-minors] given a pass, when its time is up, then the standing is not passed; a moment before, it is", async () => {
    let now = Date.now();
    const h = harness({ now: () => now });
    const jar = makeJar();
    await h.passAge(jar);
    const start = now;
    now = start + PASS_TTL_MS - 1;
    expect(await (await h.call("/api/age", { jar })).json()).toEqual({ refused: false, passed: true });
    now = start + PASS_TTL_MS;
    expect(await (await h.call("/api/age", { jar })).json()).toEqual({ refused: false, passed: false });
  });

  test("[account:age-screen-refuses-minors] given a browser refused at the screen, when its standing is read, then it is refused, from the cookie alone", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar, { dateOfBirth: bornYearsAgo(h.deps.config.account.minAge, 1) });
    expect(jar.cookies.has(REFUSED_COOKIE)).toBe(true);
    expect(await (await h.call("/api/age", { jar })).json()).toEqual({ refused: true, passed: false });
    expect(await (await h.call("/api/age", { headers: { cookie: `${REFUSED_COOKIE}=1` } })).json()).toEqual({ refused: true, passed: false });
  });

  test("[account:sign-up-open-everywhere] given a request from Australia, when the standing is read, then it answers as it does anywhere", async () => {
    const h = harness();
    const reply = await h.call("/api/age", { country: "AU" });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ refused: false, passed: false });
  });

  test("[account:sign-up-open-everywhere] [server:four-off-switches] given sign-ups switched off, when the standing is read, then the gate answers 503 switched-off with the wait, refused cookie or not", async () => {
    const h = harness();
    await h.deps.stores.switches.set("signups", false, "account-admin", "full", h.deps.now());
    for (const headers of [{}, { cookie: `${REFUSED_COOKIE}=1` }]) {
      const reply = await h.call("/api/age", { headers });
      expect(reply.status).toBe(503);
      expect(reply.headers.get("retry-after")).not.toBeNull();
      expect(await reply.json()).toMatchObject({ ok: false, code: "switched-off" });
    }
  });
});
