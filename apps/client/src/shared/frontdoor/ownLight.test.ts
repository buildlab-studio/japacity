// The player's own light (docs/rules/account.md R-ACCOUNT-033): the sheet's limits at each edge, and the light kept on
// this device only, beside the front door's other memories, one per device, and removed by "Put it out".
import { afterEach, describe, expect, test, vi } from "vitest";

import { DOOR_KEY } from "../datapage/door";
import { TRAIL_KEY } from "../datapage/family";
import { checkLight, keepOwnLight, LIGHT_FIRST_YEAR, LIGHT_NAME_CHARACTERS, LIGHT_NAME_WORDS, lightWords, OWN_LIGHT_KEY, putOutOwnLight, readOwnLight } from "./ownLight";
import { READY_ASK_KEY } from "./ready";

const YEAR = 2026;
const named = (name: string) => checkLight({ name, from: "", to: "" }, YEAR);
const years = (from: string, to: string) => checkLight({ name: "Mama Nkechi", from, to }, YEAR);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the sheet's limits", () => {
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
    expect(years("1899", "")).toEqual({ ok: false, problems: ["from-year"] });
    expect(years("", String(YEAR + 1))).toEqual({ ok: false, problems: ["to-year"] });
    expect(years("19", "")).toEqual({ ok: false, problems: ["from-year"] });
    expect(years("abcd", "")).toEqual({ ok: false, problems: ["from-year"] });
  });

  test("[R-ACCOUNT-033] given the years, then they are optional, either may stand alone, the end may be the start's own year, and never before it", () => {
    expect(years("", "")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: null } });
    expect(years("1951", "")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: 1951, to: null } });
    expect(years("", "2024")).toEqual({ ok: true, light: { name: "Mama Nkechi", from: null, to: 2024 } });
    expect(years("2024", "2024").ok).toBe(true);
    expect(years("2024", "2023")).toEqual({ ok: false, problems: ["to-before"] });
  });

  test("[R-ACCOUNT-033] given a light, then its words are the name and its years as a person says them", () => {
    expect(lightWords({ name: "Mama Nkechi", from: 1951, to: 2024 }, "to")).toBe("Mama Nkechi, 1951 to 2024");
    expect(lightWords({ name: "Mama Nkechi", from: 1951, to: null }, "to")).toBe("Mama Nkechi, 1951");
    expect(lightWords({ name: "Mama Nkechi", from: null, to: null }, "to")).toBe("Mama Nkechi");
  });
});

describe("the light kept on the device", () => {
  test("[R-ACCOUNT-033] given a light lit, then it is kept on this device under its own key beside the front door's memories, and nothing is sent", () => {
    const fetching = vi.spyOn(globalThis, "fetch");
    expect(readOwnLight()).toBeNull();
    keepOwnLight({ name: "Mama Nkechi", from: 1951, to: 2024 });
    expect(OWN_LIGHT_KEY.startsWith("japacity.door.")).toBe(true);
    expect([DOOR_KEY, TRAIL_KEY, READY_ASK_KEY].every((key) => key.startsWith("japacity.door"))).toBe(true);
    expect(JSON.parse(localStorage.getItem(OWN_LIGHT_KEY) ?? "null")).toEqual({ name: "Mama Nkechi", from: 1951, to: 2024 });
    expect(readOwnLight()).toEqual({ name: "Mama Nkechi", from: 1951, to: 2024 });
    expect(fetching).not.toHaveBeenCalled();
  });

  test("[R-ACCOUNT-033] given a second light lit, then it stands in the first one's place: one light per device", () => {
    keepOwnLight({ name: "Mama Nkechi", from: null, to: null });
    keepOwnLight({ name: "Uncle Tunde", from: 1960, to: null });
    expect(readOwnLight()).toEqual({ name: "Uncle Tunde", from: 1960, to: null });
    expect(Object.keys(localStorage).filter((key) => key === OWN_LIGHT_KEY)).toHaveLength(1);
  });

  test("[R-ACCOUNT-033] given a light kept, when it is put out, then it is gone from the device", () => {
    keepOwnLight({ name: "Mama Nkechi", from: 1951, to: 2024 });
    putOutOwnLight();
    expect(localStorage.getItem(OWN_LIGHT_KEY)).toBeNull();
    expect(readOwnLight()).toBeNull();
  });

  test("[R-ACCOUNT-033] given what is kept cannot be read or breaks a limit, then no light shows", () => {
    for (const kept of ["not json", "null", JSON.stringify({ name: 7 }), JSON.stringify({ name: "One two three four five", from: null, to: null }), JSON.stringify({ name: "Mama", from: 1800, to: null }), JSON.stringify({ name: "Mama", from: 2000, to: 1990 })]) {
      localStorage.setItem(OWN_LIGHT_KEY, kept);
      expect(readOwnLight()).toBeNull();
    }
  });

  test("[R-ACCOUNT-033] given storage the browser refuses, then reading finds no light and keeping throws nothing", () => {
    const refusing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readOwnLight(refusing)).toBeNull();
    expect(() => keepOwnLight({ name: "Mama", from: null, to: null }, refusing)).not.toThrow();
    expect(() => putOutOwnLight(refusing)).not.toThrow();
  });
});
