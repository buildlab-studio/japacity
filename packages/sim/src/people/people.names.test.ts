import { fc, test } from "@fast-check/vitest";
import { nameMix, namePool, text } from "@japacity/content";
import { describe, expect } from "vitest";

import { drawName, drawPeople, MIX_TOTAL } from "./people.names";

const peopleOf = new Map(namePool.map((entry) => [entry.n, entry.people]));
const mix: Readonly<Record<string, number>> = nameMix;
const SHAPE = /^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$/;

describe("the generated names", () => {
  test("[R-PEOPLE-053] [R-CITY-033] given the mix, when every roll from 0 to 9999 is drawn, then each people falls on exactly its share of the rolls", () => {
    const counts: Record<string, number> = {};
    for (let roll = 0; roll < MIX_TOTAL; roll += 1) {
      const people = drawPeople(nameMix, roll);
      counts[people] = (counts[people] ?? 0) + 1;
    }
    expect(counts).toEqual(nameMix);
  });

  test("[R-PEOPLE-053] [R-CITY-033] given the edges of a roll, when drawn, then 0 falls on the first people, 9999 on the last, and 10000 wraps to the first", () => {
    const peoples = Object.keys(nameMix);
    expect(drawPeople(nameMix, 0)).toBe(peoples[0]);
    expect(drawPeople(nameMix, MIX_TOTAL - 1)).toBe(peoples[peoples.length - 1]);
    expect(drawPeople(nameMix, MIX_TOTAL)).toBe(peoples[0]);
    const first = mix[peoples[0]!]!;
    expect(drawPeople(nameMix, first - 1)).toBe(peoples[0]);
    expect(drawPeople(nameMix, first)).toBe(peoples[1]);
  });

  test.prop([fc.nat(), fc.constantFrom("f" as const, "m" as const, null)])(
    "[R-PEOPLE-053] [R-CITY-033] given any roll and sex, when a name is drawn, then it is a pool name of the drawn people that suits the sex, its words have a name's shape, and the same roll draws it again",
    (roll, sex) => {
      const n = drawName(namePool, nameMix, roll, sex);
      expect(n).not.toBeNull();
      const entry = namePool.find((candidate) => candidate.n === n)!;
      expect(peopleOf.get(entry.n)).toBe(drawPeople(nameMix, roll));
      expect(sex === null || entry.sex === "either" || entry.sex === sex).toBe(true);
      expect(text[`person.name.${String(n)}`]).toMatch(SHAPE);
      expect(drawName(namePool, nameMix, roll, sex)).toBe(n);
    },
  );

  test("[R-PEOPLE-053] [R-CITY-033] given rolls that step past the mix, when names are drawn for one people, then every name of that people comes up", () => {
    const peoples = Object.keys(nameMix);
    for (const people of peoples) {
      const offset = peoples.slice(0, peoples.indexOf(people)).reduce((sum, earlier) => sum + (mix[earlier] ?? 0), 0);
      const names = namePool.filter((entry) => entry.people === people);
      const seen = new Set<number | null>();
      for (let step = 0; step < names.length; step += 1) seen.add(drawName(namePool, nameMix, offset + step * MIX_TOTAL));
      expect([...seen].sort()).toEqual(names.map((entry) => entry.n).sort());
    }
  });

  test("[R-PEOPLE-053] given a pool with no name for a sex, when a name is drawn for it, then there is none", () => {
    expect(drawName([{ n: 1, people: "tiv", sex: "m" }], { tiv: MIX_TOTAL }, 5, "f")).toBeNull();
    expect(drawName([{ n: 1, people: "tiv", sex: "m" }, { n: 2, people: "nupe", sex: "f" }], { tiv: MIX_TOTAL }, 5, "f")).toBe(2);
  });
});
