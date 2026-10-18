import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkContent } from "../engine/content";
import type { Content, Id, PlaceEntry } from "../engine/types";
import { placeChecks } from "./place.check";

const HUB: Id<"place"> = "place.ojuelegba";
const STREET: Id<"place"> = "place.bode-thomas";
const VISA_CENTRE: Id<"place"> = "place.visa-centre";
const PARK: Id<"place"> = "place.motor-park";

function place(id: Id<"place">): PlaceEntry {
  const entry = content.place[id];
  if (entry === undefined) throw new Error(`${id} is not in content`);
  return entry;
}

/** The real content with one place changed or added. */
function withPlace(entry: PlaceEntry, key: string = entry.id): Content {
  return { ...content, place: { ...content.place, [key]: entry } };
}

function problemsWith(entry: PlaceEntry, key?: string): string {
  return placeChecks(withPlace(entry, key)).join("\n");
}

describe("the real places", () => {
  test("[city:place-entry-fields] given the real content and its words, when the places are checked, then nothing is found", () => {
    expect(Object.keys(content.place).length).toBeGreaterThan(70);
    expect(placeChecks(content, text)).toEqual([]);
  });

  test("[city:place-entry-fields] given a place with a broken field, when the whole content is checked, then checkContent names it", () => {
    const broken = withPlace({ ...place(STREET), realName: null });
    expect(checkContent(content)).toEqual([]);
    expect(checkContent(broken).join("\n")).toMatch(/place\.bode-thomas: a public place has no real name/);
  });

  test("[city:place-entry-fields] given a place under a key that is not its id, or a key that is not a place id, when checked, then each is found", () => {
    expect(problemsWith(place(STREET), "place.elsewhere")).toMatch(/entry under place\.elsewhere has the id place\.bode-thomas/);
    expect(problemsWith({ ...place(STREET), id: "place.Bad_Key" }, "place.Bad_Key")).toMatch(/not a well-formed place id/);
  });

  test("[city:place-entry-fields] given a country at home, or a country with no city, when checked, then each is found", () => {
    expect(problemsWith({ ...place(STREET), country: "country.uk" })).toMatch(/country\.uk at home or on the road/);
    expect(problemsWith({ ...place("place.rye-lane"), city: null })).toMatch(/has a country and no city/);
  });
});

describe("names", () => {
  test("[city:four-kinds-of-name] given a public place with no real name, no area or no position, when checked, then each is found", () => {
    expect(problemsWith({ ...place(STREET), realName: null })).toMatch(/public place has no real name/);
    expect(problemsWith({ ...place(STREET), area: null })).toMatch(/public place has no area/);
    expect(problemsWith({ ...place(STREET), position: null, data: null })).toMatch(/public place has no position/);
  });

  test("[city:four-kinds-of-name] given an institution with a real name, a position or no area, when checked, then each is found", () => {
    expect(problemsWith({ ...place(VISA_CENTRE), realName: "A Real Visa Office" })).toMatch(/institution carries the real name/);
    const mapped = { source: "osm" as const, licence: "ODbL-1.0" as const, checked: "2026-10-08" };
    expect(problemsWith({ ...place(VISA_CENTRE), position: { latE3: 6430, lonE3: 3426 }, data: mapped })).toMatch(/would pin a real office/);
    // Its own made-up spot is allowed (city:positions-rough-on-purpose): content gives the visa centre one.
    expect(place(VISA_CENTRE).data?.source).toBe("own");
    expect(placeChecks(withPlace(place(VISA_CENTRE)))).toEqual([]);
    expect(problemsWith({ ...place(VISA_CENTRE), area: null })).toMatch(/institution has no area/);
  });

  test("[city:four-kinds-of-name] given a business with a real name, when it has no sponsor and when it has one, then only the first is found", () => {
    const hub = place("place.yaba-hub");
    expect(problemsWith({ ...hub, realName: "A Real Hub" })).toMatch(/business carries the real name A Real Hub with no sponsor/);
    expect(placeChecks(withPlace({ ...hub, realName: "A Real Hub", sponsor: { key: "sponsor.hub" } }))).toEqual([]);
  });

  test("[city:four-kinds-of-name] given a stylised place with a real name, an area or a position, when checked, then each is found", () => {
    expect(problemsWith({ ...place(PARK), realName: "A Real Park" })).toMatch(/stylised place has the real name/);
    expect(problemsWith({ ...place(PARK), area: "oshodi" })).toMatch(/stylised place has the area oshodi/);
    expect(problemsWith({ ...place(PARK), position: { latE3: 6556, lonE3: 3351 }, data: { source: "osm", licence: "ODbL-1.0", checked: "2026-10-08" } })).toMatch(/stylised place has a position from the map/);
    expect(placeChecks(withPlace({ ...place(PARK), position: { latE3: 6556, lonE3: 3351 }, data: { source: "own", licence: null, checked: "2026-10-12" } }))).toEqual([]);
  });
});

describe("positions", () => {
  test("[city:positions-rough-on-purpose] given a position with no data, a source with the wrong licence or a date that is not a day, when checked, then each is found", () => {
    const street = place(STREET);
    expect(problemsWith({ ...street, data: null })).toMatch(/a position with no source/);
    expect(problemsWith({ ...street, data: { source: "osm", licence: "CDLA-Permissive-2.0", checked: "2026-10-08" } })).toMatch(/carries the licence CDLA-Permissive-2\.0, not ODbL-1\.0/);
    expect(problemsWith({ ...street, data: { source: "overture", licence: "ODbL-1.0", checked: "2026-10-08" } })).toMatch(/not CDLA-Permissive-2\.0/);
    expect(problemsWith({ ...street, data: { source: "osm", licence: "ODbL-1.0", checked: "October" } })).toMatch(/October, is not a day/);
  });

  test("[city:positions-rough-on-purpose] given a place the lookup did not find, when it records its own source, then any licence is accepted", () => {
    expect(place("place.balogun-market").data?.source).toBe("own");
    expect(placeChecks(withPlace({ ...place("place.balogun-market"), data: { source: "own", licence: null, checked: "2026-10-08" } }))).toEqual([]);
  });
});

describe("what happens where", () => {
  test("[city:places-stage-their-acts] given a place staging an id that does not exist, when checked, then it is found", () => {
    expect(problemsWith({ ...place(STREET), stages: ["activity.nowhere"] })).toMatch(/stages activity\.nowhere, which does not exist/);
    expect(problemsWith({ ...place(STREET), stages: ["chapter.nowhere"] })).toMatch(/stages chapter\.nowhere, which does not exist/);
  });

  test("[city:places-stage-their-acts] given an id staged twice for the same where and country, when checked, then the second place is named", () => {
    const twice = withPlace({ ...place("place.adeniran-ogunsanya"), stages: ["activity.play-lotto"] });
    expect(placeChecks(twice).join("\n")).toMatch(/place\.adeniran-ogunsanya: stages activity\.play-lotto, already staged at place\.bode-thomas/);
  });

  test("[city:places-stage-their-acts] given an id staged by a place of one country and by a place that serves every country, when checked, then both are allowed", () => {
    // There is no country-less test centre (city.md, design page 11), so the room, which serves every country, stands in
    // for a country-less place staging the UK test centre's nurse's tests.
    expect(place("place.test-centre-uk").stages).toContain("activity.nmc-tests");
    const room = place("place.the-room");
    expect(placeChecks(withPlace({ ...room, stages: [...room.stages, "activity.nmc-tests"] }))).toEqual([]);
    expect(placeChecks(content)).toEqual([]);
  });

  test("[city:places-stage-their-acts] given overtime staged at four workplaces of the UK, when checked, then it is allowed as the rota board's act at each; any other id at two places of one country is still refused", () => {
    // Overtime alone may stand at several places of one country.
    const atOvertime = Object.values(content.place).filter((one) => one.country === "country.uk" && (one.stages as readonly string[]).includes("activity.overtime")).map((one) => one.id);
    expect(atOvertime.sort()).toEqual(["place.big-shop-uk", "place.care-home-uk", "place.ward-uk", "place.warehouse-uk"]);
    expect(placeChecks(content)).toEqual([]);
    const job = withPlace({ ...place("place.ward-uk"), stages: ["activity.overtime", "activity.job-uk-care"] });
    expect(placeChecks(job).join("\n")).toMatch(/place\.ward-uk: stages activity\.job-uk-care, already staged at place\.care-home-uk/);
    expect(placeChecks(job).join("\n")).not.toMatch(/stages activity\.overtime, already staged/);
  });
});

describe("the hub", () => {
  test("[city:ojuelegba-is-the-hub] given a second hub at home, when checked, then it is found", () => {
    expect(problemsWith({ ...place(STREET), hub: true })).toMatch(/2 hubs at home, not 1/);
  });

  test("[city:ojuelegba-is-the-hub] given no hub at home or no hub in a country, when checked, then each is found", () => {
    expect(problemsWith({ ...place(HUB), hub: false })).toMatch(/0 hubs at home, not 1/);
    expect(problemsWith({ ...place("place.deira"), hub: false })).toMatch(/0 hubs in country\.uae, not 1/);
  });

  test("[city:ojuelegba-is-the-hub] given a hub on the road or abroad in no country, when checked, then each is found", () => {
    expect(problemsWith({ ...place("place.road-night"), hub: true })).toMatch(/place\.road-night: a hub on the road or in no country/);
    expect(problemsWith({ ...place("place.the-room"), hub: true })).toMatch(/place\.the-room: a hub on the road or in no country/);
  });

  test("[city:ojuelegba-is-the-hub] given content with no places, when checked, then no hub is asked for", () => {
    expect(placeChecks({ ...content, place: {} })).toEqual([]);
  });
});

describe("sponsors", () => {
  const sponsor = { key: "sponsor.test" };

  test("[city:sponsor-shows-name-only] given a sponsor on an institution or a stylised place, when checked, then each is found", () => {
    expect(problemsWith({ ...place(VISA_CENTRE), sponsor })).toMatch(/sponsor on a place whose name is institution/);
    expect(problemsWith({ ...place("place.family-house"), sponsor })).toMatch(/sponsor on a place whose name is stylised/);
  });

  test("[city:sponsor-shows-name-only] given a sponsor on a place staging an offer that can be a fraud, when checked, then it is found, and one with no fraud chance is not", () => {
    const fraud = Object.values(content.offer).find((offer) => offer.fraudBp > 0 && offer.group !== "road");
    const staged = new Set<string>(Object.values(content.place).flatMap((entry) => entry.stages));
    const honest = Object.values(content.offer).find((offer) => offer.fraudBp === 0 && offer.group !== "road" && !staged.has(offer.id));
    if (fraud === undefined || honest === undefined) throw new Error("the content has no offer of each kind");
    const street = { ...place(STREET), sponsor };
    expect(placeChecks(withPlace({ ...street, stages: [fraud.id] })).join("\n")).toMatch(new RegExp(`staging ${fraud.id}, which can be a fraud`));
    expect(placeChecks(withPlace({ ...street, stages: [honest.id] }))).toEqual([]);
  });
});

describe("the road", () => {
  test("[city:road-places-are-stylised] given a road offer or a road set piece staged at a named place, when checked, then each is found", () => {
    expect(problemsWith({ ...place(STREET), stages: ["offer.road-radio"] }).split("\n")).toContain(
      "place.bode-thomas: stages offer.road-radio, a road id, at a place that is not stylised (city:road-places-are-stylised).",
    );
    expect(problemsWith({ ...place("place.rye-lane"), stages: ["setpiece.road-truth"] })).toMatch(/setpiece\.road-truth, a road id/);
  });

  test("[city:road-places-are-stylised] given the real content, when the road's offers and set pieces are found, then each is staged at a stylised place", () => {
    const stylised = Object.values(content.place).filter((entry) => entry.nameKind === "stylised");
    const staged = new Set(stylised.flatMap((entry) => entry.stages));
    const road = [...Object.values(content.offer).filter((offer) => offer.group === "road").map((offer) => offer.id), ...Object.keys(content.setpiece).filter((id) => id.startsWith("setpiece.road-"))];
    expect(road.length).toBeGreaterThan(3);
    expect(road.filter((id) => !staged.has(id as PlaceEntry["stages"][number]))).toEqual([]);
  });
});

describe("words", () => {
  test("[city:place-words-are-text-keys] given a public place whose name words differ from its real name, when checked with the words, then it is found", () => {
    const words = { ...text, "place.airport-lagos.name": "Murtala Mohammed International Airport" };
    expect(placeChecks(content, words)).toEqual([
      'place.airport-lagos: its name reads "Murtala Mohammed International Airport", not its real name "Murtala Muhammed International Airport" (city:place-words-are-text-keys).',
    ]);
  });

  test("[city:place-words-are-text-keys] given a place with no name or no blurb, when checked with the words, then each is found", () => {
    const words = { ...text, "place.costain.name": "", "place.costain.blurb": " " };
    const found = placeChecks(content, words).join("\n");
    expect(found).toMatch(/place\.costain: has no name/);
    expect(found).toMatch(/place\.costain: has no blurb/);
    expect(found).toMatch(/its name reads "", not its real name "Costain"/);
  });

  test("[city:place-words-are-text-keys] given a sign or a line overheard for a place that does not exist, when checked with the words, then it is found", () => {
    const words = { ...text, "place.nowhere.sign.1": "A shop", "place.nowhere.overheard.1": "Who is there?" };
    expect(placeChecks(content, words)).toEqual([
      "place.nowhere.sign.1: words for a place that does not exist (city:place-words-are-text-keys).",
      "place.nowhere.overheard.1: words for a place that does not exist (city:place-words-are-text-keys).",
    ]);
  });
});
