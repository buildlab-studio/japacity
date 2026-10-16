// The places of Calgary, Dubai and Castel Volturno (docs/rules/city.md "Entries: abroad", the rows of 16 Oct 2026; design
// page 15 section 3): each with its position, scope, kind of name, scene folder, shuttle and what it stages; every job
// and test of every country staged at a place of that country once the country-less workplace and test centre are gone
// (R-CITY-010); the room named per country and its spot on each country's map.
import type { Id, PlaceEntry } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, roomName, roomNameKey, text } from "../index";

const places: PlaceEntry[] = Object.values(content.place);

interface Row {
  id: Id<"place">;
  country: Id<"country">;
  nameKind: PlaceEntry["nameKind"];
  position: [number, number];
  scope: PlaceEntry["scope"];
  assets: string;
  stages: string[];
  shuttle?: true;
  hub?: true;
}

const CANADA: Id<"country"> = "country.canada";
const UAE: Id<"country"> = "country.uae";
const ITALY: Id<"country"> = "country.italy";

/** The page's rows for the three countries, in its order, with what each stages. */
const ROWS: readonly Row[] = [
  { id: "place.calgary-airport", country: CANADA, nameKind: "public", position: [51122, -114014], scope: "interior", assets: "calgary-airport", stages: [] },
  { id: "place.calgary-north-east", country: CANADA, nameKind: "business", position: [51090, -113960], scope: "exterior", assets: "calgary-north-east", stages: ["activity.job-hunt", "activity.coffee-ca", "activity.naija-shop-ca", "activity.barber-ca", "activity.send-money", "offer.street-find-ca"], hub: true },
  { id: "place.ctrain-station-ca", country: CANADA, nameKind: "institution", position: [51073, -113977], scope: "exterior", assets: "ctrain-station-ca", stages: ["activity.transit-pass-ca"] },
  { id: "place.big-shop-ca", country: CANADA, nameKind: "business", position: [51095, -113980], scope: "interior", assets: "big-shop-uk", stages: ["activity.weekly-shop-ca", "activity.buy-clothes-ca"] },
  { id: "place.warehouse-ca", country: CANADA, nameKind: "business", position: [51110, -113990], scope: "interior", assets: "warehouse-uk", stages: ["activity.job-ca-warehouse", "activity.overtime"] },
  { id: "place.care-home-ca", country: CANADA, nameKind: "business", position: [51080, -113995], scope: "interior", assets: "care-home-uk", stages: ["activity.job-ca-care-aide", "activity.overtime"] },
  { id: "place.office-ca", country: CANADA, nameKind: "business", position: [51046, -114063], scope: "interior", assets: "office-uk", stages: ["activity.job-ca-professional", "activity.job-ca-dev"] },
  { id: "place.library-ca", country: CANADA, nameKind: "institution", position: [51092, -113972], scope: "interior", assets: "library-ca", stages: ["activity.learn-tech-ca"] },
  { id: "place.church-ca", country: CANADA, nameKind: "institution", position: [51085, -113965], scope: "interior", assets: "church-uk", stages: ["activity.community-ca"] },
  { id: "place.dubai-airport", country: UAE, nameKind: "public", position: [25252, 55367], scope: "interior", assets: "dubai-airport", stages: [] },
  { id: "place.deira", country: UAE, nameKind: "public", position: [25273, 55305], scope: "exterior", assets: "deira", stages: ["activity.job-hunt", "activity.send-money", "activity.cafeteria-uae", "activity.naija-shop-uae", "activity.barber-uae", "activity.community-uae", "offer.street-find-uae"], hub: true },
  { id: "place.naif", country: UAE, nameKind: "public", position: [25272, 55310], scope: "exterior", assets: "naif", stages: ["activity.street-shopping-uae", "activity.laundry-uae", "activity.buy-clothes-uae"] },
  { id: "place.metro-station-uae", country: UAE, nameKind: "public", position: [25266, 55312], scope: "exterior", assets: "metro-station-uae", stages: ["activity.transit-pass-uae"] },
  { id: "place.big-shop-uae", country: UAE, nameKind: "business", position: [25265, 55320], scope: "interior", assets: "big-shop-uk", stages: ["activity.weekly-shop-uae"] },
  { id: "place.site-uae", country: UAE, nameKind: "business", position: [25186, 55263], scope: "exterior", assets: "site-uae", stages: ["activity.job-gulf-guard", "activity.job-gulf-cleaner", "activity.overtime"], shuttle: true },
  { id: "place.castel-volturno", country: ITALY, nameKind: "public", position: [41034, 13941], scope: "exterior", assets: "castel-volturno", stages: ["activity.job-hunt", "activity.coffee-it", "activity.naija-shop-it", "activity.send-money", "offer.street-find-it"], hub: true },
  { id: "place.via-domitiana", country: ITALY, nameKind: "public", position: [40929, 14025], scope: "exterior", assets: "via-domitiana", stages: ["activity.overtime", "activity.street-shopping-it", "activity.barber-it", "activity.buy-clothes-it"] },
  { id: "place.farm-it", country: ITALY, nameKind: "business", position: [41010, 13990], scope: "exterior", assets: "farm-it", stages: ["activity.job-it-farm-cash"], shuttle: true },
  { id: "place.big-shop-it", country: ITALY, nameKind: "business", position: [41030, 13950], scope: "interior", assets: "big-shop-uk", stages: ["activity.weekly-shop-it"] },
  { id: "place.church-it", country: ITALY, nameKind: "institution", position: [41028, 13945], scope: "interior", assets: "church-uk", stages: ["activity.community-it"] },
  { id: "place.naples-airport", country: ITALY, nameKind: "public", position: [40884, 14285], scope: "interior", assets: "naples-airport", stages: [] },
];

describe("the places of Calgary, Dubai and Castel Volturno", () => {
  test("[R-CITY-004] [R-CITY-008] [R-PLACE-013] given the page's rows, when the table is read, then each is in its country with its kind of name, position, scope, scene folder, hub, shuttle and stages; a made-up place stands at a spot of its own", () => {
    for (const row of ROWS) {
      expect({ id: row.id, entry: content.place[row.id] }).toMatchObject({
        id: row.id,
        entry: { where: "abroad", country: row.country, nameKind: row.nameKind, position: { latE3: row.position[0], lonE3: row.position[1] }, scope: row.scope, assets: row.assets, stages: row.stages, hub: row.hub ?? false, shuttle: row.shuttle ?? false },
      });
    }
    const made = ROWS.filter((row) => row.nameKind !== "public").map((row) => ({ id: row.id, data: content.place[row.id]?.data, realName: content.place[row.id]?.realName }));
    expect(made).toEqual(made.map(({ id }) => ({ id, data: { source: "own", licence: null, checked: "2026-10-16" }, realName: null })));
    // Union station was looked up in OpenStreetMap on the day it was added.
    expect(content.place["place.metro-station-uae"]?.data).toEqual({ source: "osm", licence: "ODbL-1.0", checked: "2026-10-16" });
  });

  test("[R-CITY-010] given the country-less test centre and workplace, when the table is read, then both are gone with their words, and the room stages only the country-less acts and the four meals", () => {
    expect(content.place["place.test-centre-abroad"]).toBeUndefined();
    expect(content.place["place.workplace-abroad"]).toBeUndefined();
    expect(Object.keys(text).filter((key) => key.startsWith("place.test-centre-abroad.") || key.startsWith("place.workplace-abroad."))).toEqual([]);
    expect(content.place["place.the-room"]?.stages).toEqual([
      "activity.rest",
      "activity.call-home",
      "activity.rent-flat-uk",
      "activity.rent-flat-ca",
      "activity.phone-contract-uk",
      "activity.phone-contract-ca",
      "activity.cook-own-uk",
      "activity.cook-own-ca",
      "activity.cook-own-uae",
      "activity.cook-own-it",
    ]);
  });

  test("[R-CITY-010] given every country, when its jobs and its tests are looked for, then each is staged at one place of that country, none left to a place that serves every country", () => {
    const countries = Object.keys(content.country) as Id<"country">[];
    expect(countries.sort()).toEqual(["country.canada", "country.italy", "country.uae", "country.uk"]);
    const jobs = Object.values(content.activity).filter((entry) => entry.where === "abroad" && entry.slot === "main");
    const tests = Object.values(content.activity).filter((entry) => entry.where === "abroad" && entry.cost.some((cost) => cost.reason === "fee-test"));
    const wanted = [...jobs, ...tests, content.activity["activity.driving-test"]!];
    expect(jobs.length).toBeGreaterThan(15);
    const unstaged: string[] = [];
    for (const entry of wanted) {
      const servedIn = entry.country === null ? countries : [entry.country];
      for (const country of servedIn) {
        const at = places.filter((place) => place.where === "abroad" && place.country === country && (place.stages as readonly string[]).includes(entry.id));
        if (at.length !== 1) unstaged.push(`${entry.id} in ${country}: ${String(at.length)}`);
      }
    }
    expect(unstaged).toEqual([]);
    expect(places.filter((place) => place.where === "abroad" && place.country === null).map((place) => place.id)).toEqual(["place.the-room"]);
  });

  test("[R-STREET-006] given the four finds on the street, when the places are read, then each is staged once, at its country's hub, and each has its words", () => {
    for (const [find, hub] of [
      ["offer.street-find-uk", "place.peckham"],
      ["offer.street-find-ca", "place.calgary-north-east"],
      ["offer.street-find-uae", "place.deira"],
      ["offer.street-find-it", "place.castel-volturno"],
    ] as const) {
      expect({ find, at: places.filter((place) => (place.stages as readonly string[]).includes(find)).map((place) => place.id) }).toEqual({ find, at: [hub] });
      for (const key of [`${find}.name`, `${find}.title`, `${find}.body`, `${find}.choice.look`, `${find}.said.look`, `${find}.said.walk-on`, `${find}.who`]) {
        expect({ key, words: (text[key] ?? "").trim() !== "" }).toEqual({ key, words: true });
      }
    }
    expect(content.offer["offer.street-find-ca"]?.when).toEqual([{ type: "place/is", where: "abroad", country: CANADA }]);
    expect(content.offer["offer.street-find-it"]?.when).toEqual([{ type: "place/is", where: "abroad", country: ITALY }]);
  });
});

describe("the room abroad in each country", () => {
  test("[R-WORLD-038] given each country, when the room's name is read through roomName, then it is the country's own, and the plain name with no country", () => {
    expect(roomName("country.uk")).toBe("the shared room in Peckham");
    expect(roomName(CANADA)).toBe("the basement room in north-east Calgary");
    expect(roomName(UAE)).toBe("the bed space at the camp");
    expect(roomName(ITALY)).toBe("the room in a shared flat on the Domitiana");
    expect(roomName(null)).toBe("the room");
    expect(roomNameKey(CANADA)).toBe("place.the-room.name.canada");
    expect(roomNameKey("country.nowhere")).toBe("place.the-room.name");
  });

  test("[R-WORLD-038] given each country, when its home spot is read, then the room stands at the page's made-up spot on the country's map", () => {
    expect(Object.fromEntries(Object.values(content.country).map((country) => [country.id, country.homeSpot]))).toEqual({
      "country.uk": { latE3: 51471, lonE3: -73 },
      "country.canada": { latE3: 51088, lonE3: -113955 },
      "country.uae": { latE3: 25270, lonE3: 55395 },
      "country.italy": { latE3: 40950, lonE3: 14010 },
    });
  });
});
