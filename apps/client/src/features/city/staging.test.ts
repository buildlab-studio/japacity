import { content } from "@japacity/content";
import type { Id, PlayerView, ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richView } from "../../shared/testing/fixtures";
import { heardHere, overheard, placeLines } from "./overheard";
import { byHandAt, enterable, offersHere, openingPlace, openScene, reportHere, roomSpot, servesHere, stagedAt } from "./staging";
import { ARRIVED, standAt, stepWalk, WALK_SPEED, walkTo } from "./walk";

const places = Object.values(content.place);
const HOME = { where: "home", country: null } as const;
const UK = { where: "abroad", country: "country.uk" } as const;
const ROAD = { where: "road", country: null } as const;

describe("which places can be entered", () => {
  test("[R-CITY-012] given the character at home, abroad or on the road, when the places are listed, then only that where's places are, and no other country's", () => {
    expect(enterable(HOME, places).every((place) => place.where === "home")).toBe(true);
    expect(enterable(HOME, places).map((place) => place.id)).toContain("place.ojuelegba");
    const uk = enterable(UK, places);
    expect(uk.map((place) => place.id)).toContain("place.peckham");
    expect(uk.filter((place) => place.country !== null && place.country !== "country.uk")).toEqual([]);
    expect(uk.map((place) => place.id)).not.toContain("place.deira");
    expect(enterable(ROAD, places).every((place) => place.nameKind === "stylised")).toBe(true);
    expect(enterable(ROAD, places).length).toBeGreaterThan(0);
  });

  test("[R-CITY-013] given a new life at home or a life arrived abroad, when the city opens, then it opens at the hub", () => {
    expect(openingPlace(HOME, places)).toBe("place.ojuelegba");
    expect(openingPlace(UK, places)).toBe("place.peckham");
    expect(openingPlace({ where: "abroad", country: "country.uae" }, places)).toBe("place.deira");
    expect(openingPlace(engineView().place, places)).toBe("place.ojuelegba");
    expect(openingPlace(ROAD, places)).toBe("place.road-night");
  });
});

describe("staging", () => {
  test("[R-CITY-011] given a set piece open, when the city looks for it, then it is at the place that stages it, with its question", () => {
    const view = richView();
    const scene = openScene(view, places);
    expect(scene).toEqual({ place: "place.visa-centre", setpiece: "setpiece.credibility-interview", question: "setpiece.credibility-interview.q.who-pays" });
    expect(openScene(engineView(), places)).toBeNull();
  });

  test("[R-CITY-011] given a month's report, when a line names an activity, then it is shown only at the place that stages that activity", () => {
    const line: ReportLine = { key: "line.activity.played", params: { activity: "activity.play-lotto" }, tone: "plain", attention: false, counts: [] };
    const view: Pick<PlayerView, "report" | "place"> = { place: engineView().place, report: { month: 1, lines: [line], japacityBefore: null, japacityAfter: null, attention: false } };
    expect(reportHere(view, "place.bode-thomas", places)).toEqual([line]);
    expect(reportHere(view, "place.ojuelegba", places)).toEqual([]);
  });

  test("[R-CITY-010] given an id staged nowhere for where the character is, when its place is looked up, then the default place for that where is used", () => {
    expect(stagedAt("activity.rest", HOME, places)).toBe("place.family-house");
    expect(stagedAt("activity.nothing-stages-this", UK, places)).toBe("place.the-room");
    expect(stagedAt("activity.send-money", UK, places)).toBe("place.rye-lane");
  });

  test("[R-CITY-010] given overtime staged on the rota board of every workplace in London, when the city looks for it from each, then it is shown at the workplace in hand, and from elsewhere at the first of them", () => {
    const workplaces: Id<"place">[] = ["place.care-home-uk", "place.ward-uk", "place.warehouse-uk", "place.big-shop-uk"];
    for (const id of workplaces) {
      expect(content.place[id]?.stages).toContain("activity.overtime");
      expect(stagedAt("activity.overtime", UK, places, id)).toBe(id);
    }
    expect(workplaces).toContain(stagedAt("activity.overtime", UK, places));
    expect(workplaces).toContain(stagedAt("activity.overtime", UK, places, "place.rye-lane"));
    // An id staged once is where it is staged, whatever place is in hand.
    expect(stagedAt("activity.send-money", UK, places, "place.ward-uk")).toBe("place.rye-lane");
    const line: ReportLine = { key: "line.activity.played", params: { activity: "activity.overtime" }, tone: "plain", attention: false, counts: [] };
    const view: Pick<PlayerView, "report" | "place"> = { place: abroadView().place, report: { month: 1, lines: [line], japacityBefore: null, japacityAfter: null, attention: false } };
    for (const id of workplaces) expect(reportHere(view, id, places)).toEqual([line]);
    expect(reportHere(view, "place.rye-lane", places)).toEqual([]);
  });

  // Restated 16 Oct 2026 to R-CITY-010 and design page 15 (the three countries' wave): the country-less test centre and
  // workplace are gone from content, since every job and test abroad is staged at a place of its own country.
  test("[R-CITY-010] [R-WORLD-038] given the places serving every country, when each country's map is read, then the country-less test centre and workplace are no longer places, the room stands everywhere, and each country's own places stand on its map", () => {
    const of = (id: Id<"place">) => {
      const place = content.place[id];
      if (place === undefined) throw new Error(id);
      return place;
    };
    const COUNTRIES = [
      [UK, "place.peckham"],
      [{ where: "abroad", country: "country.canada" }, "place.calgary-north-east"],
      [{ where: "abroad", country: "country.uae" }, "place.site-uae"],
      [{ where: "abroad", country: "country.italy" }, "place.farm-it"],
    ] as const;
    expect(content.place["place.test-centre-abroad" as Id<"place">]).toBeUndefined();
    expect(content.place["place.workplace-abroad" as Id<"place">]).toBeUndefined();
    expect(places.filter((place) => place.where === "abroad" && place.country === null).map((place) => place.id)).toEqual(["place.the-room"]);
    for (const [here, own] of COUNTRIES) {
      expect([here.country, servesHere(of("place.the-room"), here, places, content.activity)]).toEqual([here.country, true]);
      expect([here.country, servesHere(of(own), here, places, content.activity)]).toEqual([here.country, true]);
    }
    expect(servesHere(of("place.family-house"), HOME, places, content.activity)).toBe(true);
  });

  test("[R-WORLD-038] given the room abroad with no address of its own, when its spot on the map is read, then in London it is the design's home spot off Choumert Road, near the hub", () => {
    expect(roomSpot("country.uk", places)).toEqual({ latE3: 51471, lonE3: -73 });
    expect(roomSpot(null, places)).toBeNull();
  });

  test("[R-WORLD-038] given the three countries' home spots in content, when the room's spot is read, then it is each country's own, north-east Calgary, the camp east of Dubai and the Domitiana, and London's stays off Choumert Road", () => {
    expect(roomSpot("country.canada", places, content.country)).toEqual({ latE3: 51088, lonE3: -113955 });
    expect(roomSpot("country.uae", places, content.country)).toEqual({ latE3: 25270, lonE3: 55395 });
    expect(roomSpot("country.italy", places, content.country)).toEqual({ latE3: 40950, lonE3: 14010 });
    expect(roomSpot("country.uk", places, content.country)).toEqual({ latE3: 51471, lonE3: -73 });
  });

  test("[R-CITY-002] given open offers, when a place lists what waits there, then it names each offer by its entry only and nothing the view does not hold", () => {
    const view = richView();
    const all = places.flatMap((place) => offersHere(view, place.id, places));
    expect(all.sort()).toEqual(view.offers.map((offer) => offer.entry).sort());
    for (const place of places) for (const entry of offersHere(view, place.id, places)) expect(typeof entry).toBe("string");
  });
});

describe("talk overheard", () => {
  test("[R-CITY-003] given routes unknown and news not delivered, when talk is overheard, then none of it names them", () => {
    const view = engineView();
    const unknown = view.routes.filter((route) => route.state === "unknown").map((route) => route.id);
    expect(unknown.length).toBeGreaterThan(0);
    const lines = heardHere(view, "place.ojuelegba");
    expect(lines.filter((line) => unknown.includes(line.params.route as never))).toEqual([]);
    expect(lines.filter((line) => line.key === "city.overheard.news")).toHaveLength(view.news.length);
  });

  test("[R-CITY-003] given a route heard and a story delivered, when talk is overheard over a day, then it may name them, and the place's own lines too", () => {
    const view = abroadView();
    const heard = view.routes.filter((route) => route.state !== "unknown").map((route) => route.id);
    const lines = heardHere(view, "place.ojuelegba");
    expect(lines.filter((line) => line.key === "city.overheard.route").map((line) => line.params.route)).toEqual(heard);
    expect(lines.slice(0, placeLines("place.ojuelegba").length).every((line) => line.key.startsWith("place.ojuelegba.overheard."))).toBe(true);
    const day = Array.from({ length: 40 }, (_, nth) => overheard(view, "place.ojuelegba", "2026-10-08", nth)?.key);
    expect(new Set(day).size).toBeGreaterThan(1);
    expect(overheard(view, "place.ojuelegba", "2026-10-08", 3)).toEqual(overheard(view, "place.ojuelegba", "2026-10-08", 3));
  });
});

describe("tap to walk", () => {
  test("[R-CITY-001] given a tap on the ground, when time passes, then the character walks there in a straight line at walking pace and stops", () => {
    let walker = walkTo(standAt(0, 0, 0), 3, 4);
    walker = stepWalk(walker, 1);
    expect(Math.hypot(walker.x, walker.z)).toBeCloseTo(WALK_SPEED);
    expect(walker.x * 4).toBeCloseTo(walker.z * 3);
    walker = stepWalk(walker, 10);
    expect(walker).toMatchObject({ x: 3, z: 4, target: null });
    expect(stepWalk(walkTo(standAt(0, 0, 0), ARRIVED, 0), 0).target).toBeNull();
  });
});

describe("the acts lived by hand at home", () => {
  test("[R-ACTIVITY-019] [R-CITY-010] given the acts that repeat, when the family house or the character's own home is read at home, then each is staged there, the study a hub or a centre also stages among them; elsewhere, abroad or in another life's room none is", () => {
    const repeats = Object.values(content.activity).filter((entry) => entry.repeat === true).map((entry) => entry.id as string);
    expect(repeats).toEqual(expect.arrayContaining(["activity.cook-at-home", "activity.cook-jollof", "activity.nap", "activity.bucket-bath", "activity.watch-tv", "activity.family-time", "activity.help-shop", "activity.study-english", "activity.learn-tech", "activity.build-portfolio"]));
    expect([...byHandAt("place.family-house", "place.family-house", HOME, content.activity)].sort()).toEqual([...repeats].sort());
    expect([...byHandAt("place.family-house", "place.compound-room", HOME, content.activity)].sort()).toEqual([...repeats].sort());
    expect([...byHandAt("place.compound-room", "place.compound-room", HOME, content.activity)].sort()).toEqual([...repeats].sort());
    expect(byHandAt("place.compound-room", "place.family-house", HOME, content.activity)).toEqual([]);
    expect(byHandAt("place.yaba", "place.family-house", HOME, content.activity)).toEqual([]);
    expect(byHandAt("place.family-house", "place.family-house", UK, content.activity)).toEqual([]);
    expect(byHandAt("place.family-house", null, HOME, content.activity)).toEqual(repeats);
  });
});
