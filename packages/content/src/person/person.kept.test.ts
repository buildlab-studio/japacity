import { describe, expect, test } from "vitest";

import { KEPT_PERSON_MOST_BYTES, PERSON_NAME_LONGEST, PERSON_NAME_SHORTEST, readKeptPerson } from "./person.kept";
import { doorLookOf, SHIPPED_PEOPLE } from "./person.shipped.data";

const ADAEZE = { name: "Adaeze", look: "person_ada", archetype: "developer" } as const;

describe("the person kept with the character", () => {
  test("[account:person-kept-with-character] given the person built at the door, with or without its colours and as a ready life, when it is read, then it is kept as sent", () => {
    expect(readKeptPerson(ADAEZE)).toEqual({ ok: true, person: ADAEZE });
    const painted = { ...ADAEZE, style: { skin: "skin3", hair: "hairBrown", top: "teal", fabric: "aso-oke" } };
    expect(readKeptPerson(painted)).toEqual({ ok: true, person: painted });
    expect(readKeptPerson({ name: "Ọlá", look: "person_tunde", archetype: null })).toMatchObject({ ok: true });
  });

  test("[account:person-kept-with-character] given a name the door refuses, when it is read, then it is refused for its name at each edge of the length", () => {
    const named = (name: string) => readKeptPerson({ ...ADAEZE, name });
    expect(named("A".repeat(PERSON_NAME_SHORTEST))).toMatchObject({ ok: true });
    expect(named("A".repeat(PERSON_NAME_SHORTEST - 1))).toEqual({ ok: false, problem: "name" });
    expect(named("A".repeat(PERSON_NAME_LONGEST))).toMatchObject({ ok: true });
    expect(named("A".repeat(PERSON_NAME_LONGEST + 1))).toEqual({ ok: false, problem: "name" });
    for (const name of ["Ada Eze", "Ada_1", "Ada9", " Ada", ""]) expect(named(name)).toEqual({ ok: false, problem: "name" });
    expect(readKeptPerson({ ...ADAEZE, name: 7 })).toEqual({ ok: false, problem: "name" });
  });

  test("[account:person-kept-with-character] given a look the door does not offer, when it is read, then it is refused for its look", () => {
    const notOffered = SHIPPED_PEOPLE.filter((row) => row.role !== "passer-by").map((row) => row.id);
    expect(notOffered.length).toBeGreaterThan(0);
    for (const look of [...notOffered, "person_body_slim", "chr_ada", "scenario.graduate", ""]) {
      expect(doorLookOf(look)).toBeNull();
      expect(readKeptPerson({ ...ADAEZE, look })).toEqual({ ok: false, problem: "look" });
    }
  });

  test("[account:person-kept-with-character] given a person past the size cap, or carrying the page's photo or any key the person has not, when it is read, then it is refused", () => {
    const photo = `data:image/webp;base64,${"A".repeat(KEPT_PERSON_MOST_BYTES)}`;
    expect(readKeptPerson({ ...ADAEZE, photo })).toEqual({ ok: false, problem: "size" });
    expect(readKeptPerson({ ...ADAEZE, photo: "data:image/webp;base64,AAAA" })).toEqual({ ok: false, problem: "shape" });
    expect(readKeptPerson({ ...ADAEZE, style: { skin: "skin3", stat: "strength" } })).toEqual({ ok: false, problem: "shape" });
    expect(readKeptPerson({ ...ADAEZE, archetype: "astronaut" })).toEqual({ ok: false, problem: "shape" });
    expect(readKeptPerson(null)).toEqual({ ok: false, problem: "shape" });
    expect(readKeptPerson(undefined)).toEqual({ ok: false, problem: "shape" });
    // The cap is on the whole person as JSON: a name of two letters under a pile of marks is a legal shape and still too large.
    const marked = `Ad${"\u0301".repeat(KEPT_PERSON_MOST_BYTES)}`;
    expect(readKeptPerson({ ...ADAEZE, name: marked.slice(0, 2) })).toMatchObject({ ok: true });
    expect(readKeptPerson({ ...ADAEZE, name: marked })).toEqual({ ok: false, problem: "size" });
    const padded = { ...ADAEZE, style: { skin: "a".repeat(24), hair: "b".repeat(24), top: "c".repeat(24), fabric: "d".repeat(24) } };
    expect(readKeptPerson(padded)).toMatchObject({ ok: true });
  });
});
