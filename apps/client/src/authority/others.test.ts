// A computer person never carries the player's name (prologue.md R-PROLOGUE-009, people.md R-PEOPLE-061),
// so "Hauwa, Not a player" never stands beside the player Hauwa in the family house.
import { lifePeople, namedPeople, namePool, text } from "@japacity/content";
import { afterEach, describe, expect, test } from "vitest";

import { keepPerson } from "./person";
import { createGameStore } from "./store";
import { engineView, fakeAuthority } from "../shared/testing/fixtures";
import { setNow } from "../shared/words/now";
import { otherName, swapsFor } from "./others";
import { nameOf, say, words } from "../shared/words/text";

afterEach(() => {
  setNow(null);
  localStorage.clear();
});

const FRIEND = "person.amaka-nurse";
const TAKEN = new Set([...namedPeople, ...Object.values(lifePeople)].map((person) => person.name));

describe("a computer person never carries the player's name", () => {
  test("[R-PEOPLE-061] [R-PROLOGUE-009] given the player named Hauwa, when the friend of the family is named, then she is another Hausa-Fulani woman of the pool, the same every time, and nobody else's name", () => {
    expect(text[`${FRIEND}.name`]).toBe("Hauwa");
    setNow(4, null, swapsFor("Hauwa"));
    const other = nameOf(FRIEND);
    expect(other).not.toBe("Hauwa");
    expect(TAKEN.has(other)).toBe(false);
    const entry = namePool.find((pooled) => text[`person.name.${String(pooled.n)}`] === other)!;
    expect(entry.people).toBe("hausa-fulani");
    expect(["f", "either"]).toContain(entry.sex);
    expect(nameOf(FRIEND)).toBe(other);
    expect(otherName("Hauwa", "hauwa")).toBe(other);
    // A typed name in another case, or with a second word, is the same name.
    setNow(4, null, swapsFor("HAUWA Bello"));
    expect(nameOf(FRIEND)).toBe(other);
    // The people's lines name her the same way.
    expect(words("line.people.courted", { who: FRIEND })).toBe(`You started seeing ${other}.`);
  });

  test("[R-PEOPLE-061] given a player whose name a line carries inside it, when the line is said, then the person in it goes by the other name, and the player's own words keep the player's", () => {
    const terna = namedPeople.find((person) => person.name === "Terna")!;
    setNow(4, null, swapsFor("Terna"));
    for (const key of terna.keys) expect(say(key)).not.toMatch(/\bTerna\b/);
    // The send-off's ask is in his voice: its name and the ask's name pill carry him.
    expect(say("offer.send-off-party.name")).toContain(otherName("Terna", "Terna"));
    expect(say("offer.send-off-party.who")).toBe(otherName("Terna", "Terna"));
    // The fixed lives' own names are the player's own words, never swapped.
    setNow(4, null, swapsFor("Ada"));
    expect(say("share.first-name.scenario.ada")).toBe(text["share.first-name.scenario.ada"]);
  });

  test("[R-PEOPLE-061] given a player of another name, or no life on screen, then every person keeps the name content gives", () => {
    setNow(4, null, swapsFor("Kemi"));
    expect(nameOf(FRIEND)).toBe("Hauwa");
    setNow(null);
    expect(nameOf(FRIEND)).toBe("Hauwa");
    expect(words("line.people.courted", { who: FRIEND })).toBe("You started seeing Hauwa.");
  });

  test("[R-PROLOGUE-009] given a life named Hauwa at the door, when its view comes, then the words know the player's name from the person kept beside the save", async () => {
    keepPerson({ look: "chr_ada", name: "Hauwa", archetype: "developer" });
    const store = createGameStore(fakeAuthority(engineView()));
    await store.getState().refresh();
    expect(nameOf(FRIEND)).not.toBe("Hauwa");
  });
});
