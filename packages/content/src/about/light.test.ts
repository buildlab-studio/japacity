// A dedication light's limits (docs/rules/account.md R-ACCOUNT-033), each at its edge, as the client and the server
// both check them (server.md R-SERVER-045).
import { describe, expect, test } from "vitest";

import { checkLight, checkSentLight, LIGHT_FIRST_YEAR, LIGHT_NAME_CHARACTERS, LIGHT_NAME_WORDS, lightWords, lightYears } from "./light";

const YEAR = 2026;
const named = (name: string) => checkLight({ name, from: "", to: "" }, YEAR);
const years = (from: string, to: string) => checkLight({ name: "Mama Nkechi", from, to }, YEAR);

describe("the limits", () => {
  test("[R-ACCOUNT-033] given the limits, then a name is at most four words and forty characters, and a year runs from 1900 to the current year", () => {
    expect(LIGHT_NAME_WORDS).toBe(4);
    expect(LIGHT_NAME_CHARACTERS).toBe(40);
    expect(LIGHT_FIRST_YEAR).toBe(1900);
  });

  test("[R-ACCOUNT-033] given a name of four words, then it lights; five words do not; none at all does not", () => {
    expect(named("Mama Nkechi Grace Obi")).toEqual({ ok: true, light: { name: "Mama Nkechi Grace Obi", from: null, to: null } });
    expect(named("Mama Nkechi Grace Obi Ade")).toEqual({ ok: false, problems: ["name-words"] });
    expect(named("   ")).toEqual({ ok: false, problems: ["name-empty"] });
    // Spaces at the ends and between words are tidied before they are counted.
    expect(named("  Mama   Nkechi  ")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: null } });
  });

  test("[R-ACCOUNT-033] given a name of forty characters, then it lights; forty-one do not; a letter with its accent counts once", () => {
    const forty = `${"a".repeat(19)} ${"b".repeat(20)}`;
    expect(forty).toHaveLength(LIGHT_NAME_CHARACTERS);
    expect(named(forty).ok).toBe(true);
    expect(named(`${forty}b`)).toEqual({ ok: false, problems: ["name-characters"] });
    const accented = `Ọlámídé ${"a".repeat(32)}`;
    expect(named(accented).ok).toBe(true);
  });

  test("[R-ACCOUNT-033] given the years, then 1900 and the current year light, 1899 and next year do not, and anything not a year does not", () => {
    expect(years("1900", String(YEAR))).toEqual({ ok: true, light: { name: "Mama Nkechi", from: 1900, to: YEAR } });
    expect(years("1899", "")).toEqual({ ok: false, problems: ["first-year"] });
    expect(years("", String(YEAR + 1))).toEqual({ ok: false, problems: ["last-year"] });
    expect(years("19", "")).toEqual({ ok: false, problems: ["first-year"] });
    expect(years("abcd", "")).toEqual({ ok: false, problems: ["first-year"] });
  });

  test("[R-ACCOUNT-033] given the years, then they are optional, either may stand alone, the end may be the start's own year, and never before it", () => {
    expect(years("", "")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: null } });
    expect(years("1951", "")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: 1951, to: null } });
    expect(years("", "2024")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: 2024 } });
    expect(years("2024", "2024").ok).toBe(true);
    expect(years("2024", "2023")).toEqual({ ok: false, problems: ["last-before"] });
  });

  test("[R-ACCOUNT-033] given a light, then its words are the name and its years as a person says them", () => {
    expect(lightWords({ name: "Mama Nkechi", from: 1951, to: 2024 }, "to")).toBe("Mama Nkechi, 1951 to 2024");
    expect(lightWords({ name: "Mama Nkechi", from: 1951, to: null }, "to")).toBe("Mama Nkechi, 1951");
    expect(lightWords({ name: "Mama Nkechi", from: null, to: 2024 }, "to")).toBe("Mama Nkechi, 2024");
    expect(lightWords({ name: "Mama Nkechi", from: null, to: null }, "to")).toBe("Mama Nkechi");
    expect(lightYears({ from: null, to: null }, "to")).toBeNull();
  });
});

describe("a light as a request sends it", () => {
  test("[R-ACCOUNT-033] [R-SERVER-045] given a body with whole years, then it is checked as typed: the same light, the same problems at the same edges", () => {
    expect(checkSentLight({ name: "Mama Nkechi", from: 1951, to: 2024 }, YEAR)).toEqual({ ok: true, light: { name: "Mama Nkechi", from: 1951, to: 2024 } });
    expect(checkSentLight({ name: "Mama Nkechi" }, YEAR)).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: null } });
    expect(checkSentLight({ name: "Mama Nkechi", from: null, to: 2024 }, YEAR)).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: 2024 } });
    expect(checkSentLight({ name: "One two three four five" }, YEAR)).toEqual({ ok: false, problems: ["name-words"] });
    expect(checkSentLight({ name: "Mama", from: 1899 }, YEAR)).toEqual({ ok: false, problems: ["first-year"] });
    expect(checkSentLight({ name: "Mama", to: YEAR + 1 }, YEAR)).toEqual({ ok: false, problems: ["last-year"] });
    expect(checkSentLight({ name: "Mama", from: 2000, to: 1999 }, YEAR)).toEqual({ ok: false, problems: ["last-before"] });
  });

  test("[R-ACCOUNT-033] [R-SERVER-045] given a body that is not a light, then a name that is not text is empty and a year that is not a whole number is a bad year", () => {
    expect(checkSentLight(null, YEAR)).toEqual({ ok: false, problems: ["name-empty"] });
    expect(checkSentLight({ name: 7 }, YEAR)).toEqual({ ok: false, problems: ["name-empty"] });
    expect(checkSentLight({ name: "Mama", from: "1951" }, YEAR)).toEqual({ ok: false, problems: ["first-year"] });
    expect(checkSentLight({ name: "Mama", from: 1951 / 2, to: true }, YEAR)).toEqual({ ok: false, problems: ["first-year", "last-year"] });
  });
});
