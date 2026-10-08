import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { type PlaceFile, worldChecks } from "./check-assets";
import { checkLimits, checkThings, type LimitedFile, WORLD_LIMITS } from "./world-check";

const ROOT = join(import.meta.dirname, "..", "..");
const planted = JSON.parse(readFileSync(join(ROOT, "tools", "__fixtures__", "stripes", "place.json"), "utf8")) as PlaceFile;
const SLAB = "places/stripes/prop_slab.glb";
/** The design's slab: its top 4 mm over the ground, under the planted file's slab copy. */
const slabFloors = new Map([[SLAB, { floors: [{ y: 0.004, corners: [[-2, -1.5], [-2, 1.5], [2, 1.5]] as [number, number][] }] }]]);

const street = (over: Partial<LimitedFile> = {}, stage: Partial<NonNullable<LimitedFile["stage"]>> = {}): LimitedFile => ({
  place: "place.street",
  scope: "exterior",
  people: { low: WORLD_LIMITS.people.exterior.low, high: WORLD_LIMITS.people.exterior.high },
  stage: { shot: { width: 24 }, ground: { size: [40, 30] }, motion: [{ kind: "hang" }, { kind: "smoke" }, { kind: "bunting" }], ...stage },
  ...over,
});

describe("the limits of a place", () => {
  test("[R-WORLD-011] given a street at the rule's crowd, one moving sheet and a 24 metre frontage, when checked, then it passes; one more person in either mode fails", () => {
    expect(checkLimits(street())).toEqual([]);
    expect(checkLimits(street({ people: { low: 7, high: 10 } }))).toEqual(["R-WORLD-011: place.street shows 7 people in low mode, over 6 for an exterior place"]);
    expect(checkLimits(street({ people: { low: 6, high: 11 } }))).toEqual(["R-WORLD-011: place.street shows 11 people in high mode, over 10 for an exterior place"]);
  });

  test("[R-WORLD-011] given a room, when checked, then 4 and 6 people pass and 5 in low fails, and a room far bigger than 12 by 10 metres fails", () => {
    const room = street({ place: "place.room", scope: "interior", people: { low: 4, high: 6 } }, { walkable: [[[-6, -5], [6, -5], [6, 5], [-6, 5]]] });
    expect(checkLimits(room)).toEqual([]);
    expect(checkLimits({ ...room, people: { low: 5, high: 6 } })[0]).toMatch(/shows 5 people in low mode, over 4 for an interior place/);
    const hall = street({ place: "place.room", scope: "interior", people: { low: 4, high: 6 } }, { walkable: [[[-10, -10], [10, -10], [10, 10], [-10, 10]]] });
    expect(checkLimits(hall)[0]).toMatch(/is a room of 20.0 by 20.0 m/);
  });

  test("[R-WORLD-011] given two moving sheets, or a frontage of 40 metres, when checked, then each fails", () => {
    expect(checkLimits(street({}, { motion: [{ kind: "flag" }, { kind: "frond" }] }))).toEqual(["R-WORLD-011: place.street has 2 moving sheets, over 1"]);
    expect(checkLimits(street({}, { shot: { width: 40 } }))[0]).toMatch(/is a frontage 40.0 m wide, over about 24 m/);
  });

  test("[R-WORLD-011] given the send-off party dressed with seven guests and three dancers, when checked, then it keeps its ten; an eleventh fails", () => {
    const party = (high: number): LimitedFile =>
      street({ scope: "interior", people: { low: 4, high: 6 } }, { motion: [], walkable: [[[-6, -5], [6, -5], [6, 5], [-6, 5]]], dressings: [{ offer: "offer.send-off-party", motion: [{ kind: "smoke" }], dancers: [1, 2, 3], crowd: { low: 5, high } }] });
    expect(checkLimits(party(7))).toEqual([]);
    expect(checkLimits(party(8))[0]).toMatch(/dressed for offer.send-off-party shows 11 people with its dancers, over 10/);
  });
});

describe("the things of a place", () => {
  test("[R-WORLD-005] given things with one, two, three and no acts, when the file is checked, then one and two pass, three fails, and a thing with nothing to do fails", () => {
    const file = (counts: number[]): LimitedFile => street({}, { things: counts.map((count, index) => ({ id: `thing-${String(index)}`, acts: Array.from({ length: count }, (_, act) => act) })) });
    expect(checkThings(file([1, 2]))).toEqual([]);
    expect(checkThings(file([1, 3]))).toEqual(["R-WORLD-005: place.street has a thing thing-1 with 3 acts, over 2"]);
    expect(checkThings(file([0]))).toEqual(["R-WORLD-005: place.street has a thing thing-0 with no act"]);
  });
});

describe("the world-first checks in the build check", () => {
  test("[R-WORLD-012] given the planted file, which declares its shot, when the build check runs its world checks, then the slab on the ground fails it", () => {
    const notes: string[] = [];
    const problems = worldChecks(planted, slabFloors, notes);
    expect(problems).toEqual(["R-WORLD-012: place.stripes: the ground at 0.000 m and places/stripes/prop_slab.glb copy 0 at 0.004 m overlap 4.0 mm apart"]);
    expect(notes).toEqual([]);
  });

  test("[R-WORLD-011] given a file from before the world-first design, with no shot, when the same checks find a problem, then it is a note and not a failure", () => {
    const stage = planted.stage;
    if (stage === undefined) throw new Error("The planted file has no stage");
    const older = { ...stage };
    delete older.shot;
    const notes: string[] = [];
    expect(worldChecks({ ...planted, stage: older }, slabFloors, notes)).toEqual([]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/place\.stripes has no stage\.shot yet.*R-WORLD-012/);
  });
});
