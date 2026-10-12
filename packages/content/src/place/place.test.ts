import type { PlaceEntry } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import names from "./place.names.json";

const places: PlaceEntry[] = Object.values(content.place);

/** The numbered keys `<id>.<part>.<n>` that have words. */
function numbered(id: string, part: "sign" | "overheard"): string[] {
  return Object.keys(text).filter((key) => new RegExp(`^${id.replace(".", "\\.")}\\.${part}\\.[0-9]+$`).test(key) && (text[key] ?? "").trim() !== "");
}

const SHOPFRONTS = ["place.bode-thomas", "place.adeniran-ogunsanya", "place.broad-street", "place.ogba", "place.victoria-island", "place.yaba"];

describe("the place table", () => {
  test("[R-CITY-004] given the page's entries, when the table is read, then there are 49 public places in Lagos, 9 institutions, 3 businesses, 5 homes and stylised places and 15 abroad", () => {
    const home = places.filter((place) => place.where !== "abroad");
    expect(home.filter((place) => place.nameKind === "public")).toHaveLength(49);
    expect(home.filter((place) => place.nameKind === "institution")).toHaveLength(9);
    expect(home.filter((place) => place.nameKind === "business")).toHaveLength(3);
    expect(home.filter((place) => place.nameKind === "stylised")).toHaveLength(5);
    expect(places.filter((place) => place.where === "abroad")).toHaveLength(15);
  });

  test("[R-CITY-010] given every place, when its staged ids are looked up, then each exists in its kind's table", () => {
    const tables: Record<string, Record<string, unknown>> = { activity: content.activity, offer: content.offer, setpiece: content.setpiece, chapter: content.chapter };
    const missing = places.flatMap((place) => place.stages.filter((id) => tables[id.split(".")[0] ?? ""]?.[id] === undefined).map((id) => `${place.id} ${id}`));
    expect(places.flatMap((place) => place.stages).length).toBeGreaterThan(60);
    expect(missing).toEqual([]);
  });

  test("[R-CITY-010] given the default places, when they are looked up, then the family house is at home, the room abroad and the yard at night on the road", () => {
    expect(content.place["place.family-house"]?.where).toBe("home");
    expect(content.place["place.the-room"]).toMatchObject({ where: "abroad", country: null });
    expect(content.place["place.road-night"]).toMatchObject({ where: "road", nameKind: "stylised" });
  });

  test("[R-CITY-008] given every place with a position, when its data is read, then it was checked on a day, under 100 features in all; a public place not found and every made-up spot record their own source", () => {
    const pinned = places.filter((place) => place.position !== null);
    expect(pinned.length).toBeLessThan(100);
    expect(pinned.every((place) => place.data !== null && /^\d{4}-\d{2}-\d{2}$/.test(place.data.checked))).toBe(true);
    // A public place carries the map's own position; the one the lookup did not find says so.
    expect(pinned.filter((place) => place.nameKind === "public" && place.data?.source !== "osm").map((place) => place.id)).toEqual(["place.balogun-market"]);
    // A place with no address of its own (an office known by its area, a home on a made-up street) stands at a made-up spot, its own, with no licence to carry.
    const own = pinned.filter((place) => place.nameKind !== "public");
    expect(own.map((place) => place.id)).toEqual(expect.arrayContaining(["place.family-house", "place.compound-room", "place.visa-centre", "place.passport-office", "place.yaba-hub"]));
    expect(own.every((place) => place.data?.source === "own" && place.data.licence === null)).toBe(true);
    // Their room has no spot: it stands near whoever lives there (R-WORLD-020).
    expect(content.place["place.their-room"]?.position).toBeNull();
  });

  test("[R-CITY-014] given every place, when its own crowd caps are read, then each is within the tuning's caps for its mode", () => {
    const { crowdLow, crowdHigh } = content.tuning.city;
    const over = places.filter((place) => place.crowd.low < 1 || place.crowd.low > crowdLow || place.crowd.high > crowdHigh || place.crowd.low > place.crowd.high);
    expect(over.map((place) => place.id)).toEqual([]);
  });

  test("[R-CITY-016] given every place, when its traditional share is read, then it is one of the page's shares, and a place for Saturday occasions exists", () => {
    const shares = [6000, 5000, 2000, 2500];
    expect(places.filter((place) => !shares.includes(place.traditionalBp)).map((place) => place.id)).toEqual([]);
    expect(places.filter((place) => place.occasion).map((place) => place.id)).toContain("place.family-house");
  });
});

describe("the places' words", () => {
  test("[R-CITY-024] given every place, when its words are looked up, then it has a name and a blurb, and a public name is its real name", () => {
    const missing = places.flatMap((place) => [`${place.id}.name`, `${place.id}.blurb`]).filter((key) => (text[key] ?? "").trim() === "");
    expect(missing).toEqual([]);
    const differ = places.filter((place) => place.nameKind === "public" && text[`${place.id}.name`] !== place.realName);
    expect(differ.map((place) => place.id)).toEqual([]);
  });

  test("[R-CITY-024] given every place with shopfronts, when its signs are looked up, then it has at least two", () => {
    const signed = places.filter((place) => numbered(place.id, "sign").length > 0).map((place) => place.id);
    expect(signed).toEqual(expect.arrayContaining(SHOPFRONTS));
    expect(signed.filter((id) => numbered(id, "sign").length < 2)).toEqual([]);
  });

  test("[R-CITY-003] given every hub and every market, when its talk overheard is looked up, then it has at least three lines and none names a route or a story", () => {
    const talky = places.filter((place) => place.hub || place.id.endsWith("-market"));
    expect(talky.length).toBeGreaterThan(8);
    expect(talky.filter((place) => numbered(place.id, "overheard").length < 3).map((place) => place.id)).toEqual([]);
    const lines = places.flatMap((place) => numbered(place.id, "overheard").map((key) => text[key] ?? ""));
    expect(lines.filter((line) => /route\.|news\.|\{/.test(line))).toEqual([]);
  });
});

describe("made-up names", () => {
  test("[R-CITY-007] given every made-up name checked, when the signs and names are read, then each checked name is shown and no working name that was replaced is", () => {
    const shown = Object.entries(text).filter(([key]) => key.startsWith("place.")).map(([, words]) => words);
    expect(names.length).toBeGreaterThan(7);
    expect(names.filter((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.nameCheck.date) || row.nameCheck.searches.length < 2)).toEqual([]);
    expect(names.filter((row) => !shown.some((words) => words.includes(row.nameCheck.name))).map((row) => row.nameCheck.name)).toEqual([]);
    const replaced = names.filter((row) => row.nameCheck.workingName !== row.nameCheck.name).map((row) => row.nameCheck.workingName);
    expect(replaced.filter((working) => shown.some((words) => words.includes(working)))).toEqual([]);
  });

  test("[R-CITY-007] given every business place, when its name is looked up, then a name check row records it unless the name is a description", () => {
    const checked = new Set(names.map((row) => row.nameCheck.name));
    const businesses = places.filter((place) => place.nameKind === "business").map((place) => text[`${place.id}.name`] ?? "");
    expect(businesses.filter((name) => !checked.has(name) && !/^(an?|the) /.test(name))).toEqual([]);
  });
});
