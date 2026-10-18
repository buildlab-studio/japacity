// The places of London (docs/rules/city.md "Entries: abroad", the London rows; design page 10 section 4):
// each with its position, scope, kind of name, scene folder and what it stages, the UK's jobs at their own workplaces,
// and every staged id staged once for each country (city:places-stage-their-acts).
import type { Id, PlaceEntry } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import names from "./place.names.json";

const places: PlaceEntry[] = Object.values(content.place);

interface Row {
  id: Id<"place">;
  nameKind: PlaceEntry["nameKind"];
  position: [number, number];
  scope: PlaceEntry["scope"];
  assets: string;
  stages: string[];
}

/** The page's London rows, in its order, with what each stages. */
const LONDON: readonly Row[] = [
  { id: "place.peckham", nameKind: "public", position: [51473, -70], scope: "exterior", assets: "peckham", stages: ["activity.job-hunt", "offer.street-find-uk"] },
  {
    id: "place.rye-lane",
    nameKind: "public",
    position: [51468, -69],
    scope: "exterior",
    assets: "rye-lane",
    stages: ["activity.send-money", "activity.street-shopping-uk", "activity.chicken-shop", "activity.job-uk-kitchen-cash", "activity.naija-shop-uk", "activity.barber-uk", "activity.buy-clothes-uk", "activity.pub-pint"],
  },
  { id: "place.peckham-rye-station", nameKind: "public", position: [51470, -69], scope: "exterior", assets: "peckham-rye-station", stages: ["activity.bus-pass-uk", "activity.job-uk-courier-cash"] },
  { id: "place.big-shop-uk", nameKind: "business", position: [51474, -68], scope: "interior", assets: "big-shop-uk", stages: ["activity.weekly-shop-uk", "activity.job-uk-retail-part", "activity.overtime"] },
  { id: "place.care-home-uk", nameKind: "business", position: [51467, -54], scope: "interior", assets: "care-home-uk", stages: ["activity.job-uk-care", "activity.job-uk-senior-care", "activity.overtime"] },
  { id: "place.ward-uk", nameKind: "institution", position: [51468, -94], scope: "interior", assets: "ward-uk", stages: ["activity.job-uk-nurse", "activity.overtime"] },
  { id: "place.office-uk", nameKind: "business", position: [51505, -86], scope: "interior", assets: "office-uk", stages: ["activity.job-uk-skilled", "activity.job-uk-graduate", "activity.job-uk-senior-dev"] },
  { id: "place.warehouse-uk", nameKind: "business", position: [51487, -62], scope: "interior", assets: "warehouse-uk", stages: ["activity.job-uk-warehouse", "activity.overtime"] },
  { id: "place.church-uk", nameKind: "institution", position: [51486, -66], scope: "interior", assets: "church-uk", stages: ["activity.community-uk"] },
  { id: "place.test-centre-uk", nameKind: "institution", position: [51494, -100], scope: "interior", assets: "english-test-centre", stages: ["activity.nmc-tests", "activity.driving-test"] },
  { id: "place.heathrow", nameKind: "public", position: [51468, -459], scope: "interior", assets: "heathrow", stages: [] },
];

const UK_JOBS = Object.values(content.activity)
  .filter((entry) => entry.slot === "main" && entry.country === "country.uk")
  .map((entry) => entry.id);

describe("the places of London", () => {
  test("[city:place-entry-fields] [city:positions-rough-on-purpose] given the page's London rows, when the table is read, then each is in London in the UK with its kind of name, position, scope, scene folder and stages; a made-up place stands at a spot of its own", () => {
    for (const row of LONDON) {
      const entry = content.place[row.id];
      expect({ id: row.id, entry }).toMatchObject({
        id: row.id,
        entry: { where: "abroad", country: "country.uk", city: "london", nameKind: row.nameKind, position: { latE3: row.position[0], lonE3: row.position[1] }, scope: row.scope, assets: row.assets, stages: row.stages },
      });
    }
    const made = LONDON.filter((row) => row.nameKind !== "public").map((row) => ({ id: row.id, data: content.place[row.id]?.data, realName: content.place[row.id]?.realName }));
    expect(made).toEqual(made.map(({ id }) => ({ id, data: { source: "own", licence: null, checked: "2026-10-16" }, realName: null })));
  });

  test("[city:places-stage-their-acts] given the room abroad, when its stages are read, then it cooks in each country's money and keeps the country-less acts, the hunt, the community and money home being at each country's own places", () => {
    // City.md's room row: the room keeps rest, the call home, the flats,
    // the phone contracts and the four meals.
    const room = content.place["place.the-room"];
    expect(room?.stages).toEqual(expect.arrayContaining(["activity.cook-own-uk", "activity.rest", "activity.call-home"]));
    expect(room?.stages.filter((id) => ["activity.community-uk", "activity.job-hunt", "activity.send-money"].includes(id))).toEqual([]);
    expect(content.activity["activity.cook-own-uk"]?.country).toBe("country.uk");
  });

  test("[city:places-stage-their-acts] given every job in the UK, when the places are read, then each is staged at one London place, and there is no workplace abroad", () => {
    expect(UK_JOBS.length).toBeGreaterThan(8);
    for (const job of UK_JOBS) {
      const at = places.filter((place) => place.country === "country.uk" && (place.stages as readonly string[]).includes(job)).map((place) => place.id);
      expect({ job, at: at.length }).toEqual({ job, at: 1 });
    }
    // Every country's jobs are at its own places (design page 11), so there is no country-less workplace.
    expect(content.place["place.workplace-abroad"]).toBeUndefined();
  });

  test("[city:places-stage-their-acts] given every place, when the staged ids are counted for each where and country, then none is staged twice but overtime, the rota board's act at every workplace", () => {
    const seen = new Map<string, Id<"place">>();
    const twice: string[] = [];
    for (const place of places) {
      for (const id of place.stages.filter((staged) => staged !== "activity.overtime")) {
        const key = `${place.where} ${String(place.country)} ${id}`;
        const before = seen.get(key);
        if (before !== undefined) twice.push(`${id} at ${before} and ${place.id}`);
        seen.set(key, place.id);
      }
    }
    expect(twice).toEqual([]);
  });

  test("[city:made-up-names-checked] [city:place-words-are-text-keys] given London's businesses, when their names and signs are read, then each is shown by description, its made-up name stands on its first sign, and that name's check is recorded", () => {
    const checked = new Set(names.map((row) => row.nameCheck.name));
    for (const row of LONDON.filter((one) => one.nameKind === "business")) {
      expect(text[`${row.id}.name`]).toMatch(/^the /);
      const sign = text[`${row.id}.sign.1`] ?? "";
      expect({ id: row.id, checked: checked.has(sign) }).toEqual({ id: row.id, checked: true });
      expect((text[`${row.id}.sign.2`] ?? "").trim()).not.toBe("");
    }
    for (const row of LONDON) expect({ id: row.id, blurb: (text[`${row.id}.blurb`] ?? "").trim() !== "", dashed: /[\u2013\u2014]/u.test(text[`${row.id}.blurb`] ?? "") }).toEqual({ id: row.id, blurb: true, dashed: false });
  });

  test("[city:made-up-names-checked] [city:place-words-are-text-keys] given Rye Lane's terrace, when its boards are read, then the chicken shop, the Nigerian shop, the barber, the clothes shop, the transfer shop and the pub each have a short board of two lines at most, a made-up name over its trade, the name's check recorded", () => {
    const checked = new Set(names.map((row) => row.nameCheck.name));
    for (const board of ["chicken", "naija", "barber", "clothes", "transfer", "pub"]) {
      const lines = (text[`place.rye-lane.sign.${board}`] ?? "").split("\n");
      expect({ board, lines: lines.length, long: lines.filter((line) => line.length > 20), checked: checked.has(lines[0] ?? "") }).toEqual({ board, lines: 2, long: [], checked: true });
    }
  });
});
