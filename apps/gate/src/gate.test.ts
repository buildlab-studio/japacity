import { describe, expect, test } from "vitest";

import { admits, codeMatches, cookieFor, COOKIE, YEAR_SECONDS } from "./gate";

const SECRET = "the-secret-in-the-link";
const NOW = 1_800_000_000;

function valueOf(setCookie: string): string {
  return setCookie.slice(`${COOKIE}=`.length).split(";")[0] ?? "";
}

describe("the invite code", () => {
  test("given the secret, when it is the code, then it matches", async () => {
    expect(await codeMatches(SECRET, SECRET)).toBe(true);
  });

  test("given a code that is not the secret, when it is checked, then it does not match, whatever its length", async () => {
    for (const code of ["", "x", SECRET.slice(0, -1), `${SECRET}x`, SECRET.toUpperCase(), ` ${SECRET}`]) {
      expect(await codeMatches(code, SECRET)).toBe(false);
    }
  });

  test("given no secret set, when any code is checked, then nobody is admitted", async () => {
    expect(await codeMatches("", "")).toBe(false);
    expect(await codeMatches("anything", "")).toBe(false);
  });
});

describe("the cookie", () => {
  test("given an admitted phone, when the cookie is made, then it is HttpOnly, Secure, SameSite=Lax, host-only and kept a year", async () => {
    const cookie = await cookieFor(SECRET, NOW);
    expect(cookie.startsWith(`${COOKIE}=`)).toBe(true);
    expect(COOKIE.startsWith("__Host-")).toBe(true);
    const attributes = cookie.split(";").slice(1).map((part) => part.trim());
    expect(attributes).toEqual(expect.arrayContaining(["HttpOnly", "Secure", "SameSite=Lax", "Path=/", `Max-Age=${String(YEAR_SECONDS)}`]));
    expect(attributes.some((part) => part.startsWith("Domain"))).toBe(false);
    expect(YEAR_SECONDS).toBe(365 * 24 * 60 * 60);
  });

  test("given a cookie, when it is read, then it carries neither the secret nor anything about the visitor", async () => {
    const value = valueOf(await cookieFor(SECRET, NOW));
    expect(value).not.toContain(SECRET);
    expect(value).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
  });

  test("given the cookie the gate made, when it comes back within the year, then it admits", async () => {
    const value = valueOf(await cookieFor(SECRET, NOW));
    expect(await admits(`${COOKIE}=${value}`, SECRET, NOW)).toBe(true);
    expect(await admits(`theme=dark; ${COOKIE}=${value}; other=1`, SECRET, NOW + YEAR_SECONDS)).toBe(true);
  });

  test("given the cookie, when it comes back after the year, then it does not admit", async () => {
    const value = valueOf(await cookieFor(SECRET, NOW));
    expect(await admits(`${COOKIE}=${value}`, SECRET, NOW + YEAR_SECONDS + 1)).toBe(false);
  });

  test("given a cookie dated in the future, when it comes back, then it does not admit", async () => {
    const value = valueOf(await cookieFor(SECRET, NOW + 3600));
    expect(await admits(`${COOKIE}=${value}`, SECRET, NOW)).toBe(false);
  });

  test("given a cookie changed by hand or signed with another secret, when it comes back, then it does not admit", async () => {
    const value = valueOf(await cookieFor(SECRET, NOW));
    const [issued, signature] = value.split(".");
    const flipped = `${signature?.startsWith("A") === true ? "B" : "A"}${signature?.slice(1) ?? ""}`;
    const forged = [
      `${String(Number(issued) + 1)}.${signature ?? ""}`,
      `${issued ?? ""}.${flipped}`,
      valueOf(await cookieFor("another-secret", NOW)),
      "",
      "1800000000",
      "1800000000.",
      "abc.def",
      `${value}.extra`,
    ];
    for (const fake of forged) expect(await admits(`${COOKIE}=${fake}`, SECRET, NOW)).toBe(false);
  });

  test("given no cookie header or none of ours, when asked, then it does not admit", async () => {
    expect(await admits(null, SECRET, NOW)).toBe(false);
    expect(await admits("theme=dark", SECRET, NOW)).toBe(false);
  });

  test("given no secret set, when even a once-good cookie comes back, then it does not admit", async () => {
    const value = valueOf(await cookieFor(SECRET, NOW));
    expect(await admits(`${COOKIE}=${value}`, "", NOW)).toBe(false);
  });
});
