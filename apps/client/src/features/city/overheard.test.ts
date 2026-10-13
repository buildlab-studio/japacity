// Street talk abroad (docs/rules/world.md R-WORLD-026, city.md R-CITY-003, streets.md R-STREET-007):
// a place abroad says only its own lines, never the Lagos talk of the news and the routes, and the
// room abroad has its own short set: the landlord, the radiator, a neighbour through the wall.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../shared/testing/fixtures";
import { cityText, heardWords } from "./city.words";
import { heardHere, overheard, placeLines, speakerOf } from "./overheard";
import { newGame } from "../../shared/testing/fixtures";

const ROOM = "place.the-room";
const DASHES = /[‐‒–—―−]/;

/** Every line heard in a place over a long day. */
function heardAllDay(view: ReturnType<typeof abroadView>, place: string): string[] {
  return Array.from({ length: 60 }, (_, nth) => overheard(view, place, "2026-10-09", nth)?.key).filter((key): key is string => key !== undefined);
}

describe("talk overheard abroad", () => {
  test("[R-WORLD-026] [R-CITY-003] given Ada in the room abroad with stories delivered and routes heard, when talk is overheard all day, then every line is the room's own and none is the talk of Lagos", () => {
    const view = abroadView();
    expect(view.news.length).toBeGreaterThan(0);
    expect(view.routes.some((route) => route.state !== "unknown")).toBe(true);
    const lines = heardHere(view, ROOM).map((line) => line.key);
    expect(lines.filter((key) => key === "city.overheard.news" || key === "city.overheard.route")).toEqual([]);
    const day = heardAllDay(view, ROOM);
    expect(day.length).toBe(60);
    expect(day.every((key) => lines.includes(key))).toBe(true);
  });

  test("[R-WORLD-026] given the room abroad, when its lines are read, then it has its own short set beside content's, about the landlord, the radiator and a neighbour through the wall, each with words and no dash", () => {
    const own = heardHere(abroadView(), ROOM).map((line) => line.key);
    const set = own.filter((key) => key.startsWith("city.overheard.room."));
    expect(set.length).toBeGreaterThanOrEqual(3);
    expect(own).toEqual([...placeLines(ROOM), ...set]);
    const said = set.map((key) => heardWords(key, {}));
    expect(said).toEqual(set.map((key) => cityText[key]));
    expect(said.filter((words) => DASHES.test(words))).toEqual([]);
    expect(said.some((words) => /landlord/i.test(words))).toBe(true);
    expect(said.some((words) => /radiator/i.test(words))).toBe(true);
    expect(said.some((words) => /mummy|wall/i.test(words))).toBe(true);
  });

  test("[R-STREET-007] [R-WORLD-026] given Peckham with stories delivered and routes heard, when talk is overheard, then it is only Peckham's own lines", () => {
    const view = abroadView();
    expect(heardHere(view, "place.peckham").map((line) => line.key)).toEqual(placeLines("place.peckham"));
  });

  test("[R-WORLD-026] given a place abroad with no lines of its own, when talk is overheard, then none is, rather than the talk of home", () => {
    const view = abroadView();
    expect(placeLines("place.nowhere-abroad")).toEqual([]);
    expect(heardHere(view, "place.nowhere-abroad")).toEqual([]);
    expect(overheard(view, "place.nowhere-abroad", "2026-10-09", 0)).toBeNull();
  });

  test("[R-WORLD-026] given every story's headline at every stage, when it is talked of in the street, then the talk sits inside one pair of curly quotes and carries no straight quote", () => {
    const heads = Object.keys(text).filter((key) => key.startsWith("news.") && key.endsWith(".head"));
    expect(heads.some((key) => (text[key] ?? "").startsWith('"'))).toBe(true);
    for (const head of heads) {
      const said = heardWords("city.overheard.news", { head });
      expect(said).not.toContain('"');
      expect(said.match(/[\u201c\u201d]/g)).toHaveLength(2);
    }
  });

  test("[R-WORLD-026] given the room in a compound, when its own lines are read, then each names what only a compound has: the compound itself, next door, its one tap for the rooms, the landlord; none could be the family's yard", () => {
    const said = placeLines("place.compound-room").map((key) => heardWords(key, {}));
    expect(said.length).toBeGreaterThanOrEqual(4);
    for (const words of said) expect({ words, named: /compound|next door|landlord|rooms?\b/i.test(words) }).toEqual({ words, named: true });
    expect(said.some((words) => /sweep the compound/i.test(words))).toBe(true);
    expect(said.some((words) => /^Next door: /.test(words))).toBe(true);
    expect(said.some((words) => /one tap/i.test(words))).toBe(true);
    expect(said.some((words) => /landlord/i.test(words))).toBe(true);
    expect(said.filter((words) => /\byard\b/i.test(words))).toEqual([]);
  });

  test("[R-WORLD-026] given the hostel room, when its own lines are read, then each is the corridor's: the line of buckets, the next room's noise, the shared nook; none could be the family's or the compound's", () => {
    const said = placeLines("place.hostel-room").map((key) => heardWords(key, {}));
    expect(said.length).toBeGreaterThanOrEqual(2);
    expect(said.length).toBeLessThanOrEqual(3);
    for (const words of said) expect({ words, corridor: /bucket|room four|nook|gate/i.test(words), elsewhere: /compound|mama|landlord/i.test(words) }).toEqual({ words, corridor: true, elsewhere: false });
  });

  test("[R-WORLD-026] given the family house, when its own lines are read, then each is the family's: Papa, Mama or an uncle, never a line any home could hear", () => {
    const said = placeLines("place.family-house").map((key) => heardWords(key, {}));
    expect(said.length).toBeGreaterThanOrEqual(3);
    for (const words of said) expect({ words, family: /father|papa|mama|uncle|aunty/i.test(words) }).toEqual({ words, family: true });
  });
});


describe("who says a line overheard", () => {
  const said = (key: string): string => text[key] ?? cityText[key] ?? key;

  test("[R-WORLD-026] given the family house, when its own lines are heard, then each carries who says it, read from content beside the line, and a compound's rota, said by nobody in particular, carries no one", () => {
    const view = newGame("scenario.ada").view();
    const family = heardHere(view, "place.family-house").filter((line) => line.key.startsWith("place.family-house.overheard."));
    expect(family.map((line) => [line.key, line.by === undefined ? null : said(line.by)])).toEqual([
      ["place.family-house.overheard.1", "Your brother"],
      ["place.family-house.overheard.2", "Mama"],
      ["place.family-house.overheard.3", "Mama"],
    ]);
    const rota = heardHere(view, "place.compound-room").find((line) => line.key === "place.compound-room.overheard.1");
    expect(rota).toEqual({ key: "place.compound-room.overheard.1", params: {} });
    // The talk of the news and the routes is nobody's in particular.
    expect(heardHere(view, "place.ojuelegba").filter((line) => !line.key.startsWith("place.")).every((line) => line.by === undefined)).toBe(true);
    expect(heardHere(view, "place.ojuelegba").find((line) => line.key === "place.ojuelegba.overheard.1")?.by).toBe("place.ojuelegba.overheard.1.by");
  });

  test("[R-WORLD-026] given a line's speaker, when the bubble is given its name, then Mama's words float over Mama where she stands in the house, a brother no thing stands for is named over the resident nearest, and a line no one is named for keeps the house's voice", () => {
    const things = [{ id: "sofa", label: "city.thing.sofa" }, { id: "mama", label: "city.thing.mama" }];
    expect(speakerOf({ by: "place.family-house.overheard.3.by" }, things, said)).toEqual({ name: "Mama", who: "mama" });
    expect(speakerOf({ by: "place.family-house.overheard.1.by" }, things, said)).toEqual({ name: "Your brother" });
    expect(speakerOf({}, things, said)).toEqual({});
    // No Mama in the place: named, over the resident nearest.
    expect(speakerOf({ by: "place.family-house.overheard.2.by" }, [], said)).toEqual({ name: "Mama" });
  });
});
