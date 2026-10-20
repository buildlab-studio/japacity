import { describe, expect, test } from "vitest";

import { familyNames } from "../family/family.data";
import { content, text, textTables } from "../index";
import type { NamedPerson, NamePeople } from "./person.names.data";
import { familyPeople, nameMix, namedMix, namedPeople, namePool, peopleRegion } from "./person.names.data";
import { faithProblems, institutionProblems, namedMixProblems, nameShaped, namesUsed, roleProblems } from "./person.names.check";
import { recurringPeople } from "./person.recurring.data";

const nameOf = (n: number) => text[`person.name.${String(n)}`] ?? "";
const poolByName = new Map(namePool.map((entry) => [nameOf(entry.n), entry]));
const PEOPLES = Object.keys(peopleRegion) as NamePeople[];
/** Pool names that are also English words, so the scan of the words cannot tell them from the word. */
const ALSO_WORDS = ["Blessing", "Precious"];

/** Every named person the game's own words carry, the family's included. */
function everyNamed(): NamedPerson[] {
  const family = Object.values(familyNames).flatMap((names) =>
    Object.values(names ?? {}).map((name): NamedPerson => ({ name, people: poolByName.get(name)?.people ?? "yoruba", role: "relative", keys: [] })),
  );
  return [...namedPeople, ...recurringPeople, ...family];
}

describe("the name pool", () => {
  test("[person:computer-names-generated] given every generated name, when its shape is read, then it is one to three words of letters each starting with a capital, with no digit, underscore, dot or @", () => {
    const names = namePool.map((entry) => nameOf(entry.n));
    expect(names.filter((name) => !nameShaped(name))).toEqual([]);
    expect(["Tunde", "Ndagi Jiya", "Aunty Ladi Musa"].every(nameShaped)).toBe(true);
    expect(["tunde", "Tunde1", "tunde_x", "T.unde", "@tunde", "Aunty Ladi Musa Bello", ""].some(nameShaped)).toBe(false);
  });

  test("[person:computer-names-generated] given the pool and its words, when they are matched, then every entry has a name, every `person.name` key has an entry, and no name is given twice", () => {
    const keys = Object.keys(textTables["personNames"] ?? {});
    expect(keys.sort()).toEqual(namePool.map((entry) => `person.name.${String(entry.n)}`).sort());
    const names = namePool.map((entry) => nameOf(entry.n));
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  test("[person:computer-names-generated] given the mix, when it is read, then it sums to 10000, names every people of the pool, puts the three largest first, and gives every other a real share", () => {
    expect(Object.values(nameMix).reduce((sum, share) => sum + share, 0)).toBe(10000);
    expect(Object.keys(nameMix).sort()).toEqual([...PEOPLES].sort());
    const sorted = Object.entries(nameMix).sort((left, right) => right[1] - left[1]);
    expect(sorted.slice(0, 3).map(([people]) => people).sort()).toEqual(["hausa-fulani", "igbo", "yoruba"]);
    expect(Object.keys(nameMix).slice(0, 3).sort()).toEqual(["hausa-fulani", "igbo", "yoruba"]);
    expect(sorted.slice(3).filter(([, share]) => share < 300)).toEqual([]);
  });

  test("[person:computer-names-generated] given every people, when its names are counted, then it has at least three, and names for a woman and for a man", () => {
    const short = PEOPLES.filter((people) => {
      const names = namePool.filter((entry) => entry.people === people);
      const women = names.filter((entry) => entry.sex !== "m");
      const men = names.filter((entry) => entry.sex !== "f");
      return names.length < 3 || women.length === 0 || men.length === 0;
    });
    expect(short).toEqual([]);
  });

  test("[person:computer-names-generated] given the pool, when names are read by faith and region, then Christian and Muslim names both appear in the north and in the south (names rule 4)", () => {
    expect(faithProblems(namePool)).toEqual([]);
    expect(faithProblems(namePool.filter((entry) => !(entry.faith === "muslim" && peopleRegion[entry.people] === "south")))).toEqual(["no muslim name in the south"]);
  });

  test("[person:one-mixed-name-pool] given the ready lives, when their words are looked up, then none has a name or a first name of its own, so the only first name a life goes by is the one the player gives at the door", () => {
    const lives = Object.keys(content.scenario).filter((id) => id !== "scenario.prologue");
    expect(lives.length).toBeGreaterThan(0);
    expect(lives.flatMap((life) => [`${life}.name`, `share.first-name.${life}`]).filter((key) => key in text)).toEqual([]);
  });
});

describe("who is named in the game's words", () => {
  test("[person:computer-names-generated] given every named person, when their name is looked up, then it is in the pool under the same people, and every key said to carry it does", () => {
    const wrong = [...namedPeople, ...recurringPeople].filter((person) => poolByName.get(person.name)?.people !== person.people);
    expect(wrong.map((person) => person.name)).toEqual([]);
    const missing = everyNamed().flatMap((person) => person.keys.filter((key) => !new RegExp(`\\b${person.name}\\b`).test(text[key] ?? "")).map((key) => `${key} ${person.name}`));
    expect(missing).toEqual([]);
  });

  test("[person:computer-names-generated] given every computer partner named by a given name, when that name is read, then it is a name from the pool", () => {
    // A stranger the character has never met goes by what they are ("The citizen"), not by a name.
    const partners = Object.values(content.person).filter((person) => person.role === "partner" && !/^(The|Your) /.test(text[`${person.id}.name`] ?? ""));
    expect(partners.length).toBeGreaterThan(0);
    expect(partners.filter((person) => !poolByName.has(text[`${person.id}.name`] ?? "")).map((person) => person.id)).toEqual([]);
  });

  test("[person:computer-names-generated] given the game's words outside the places and the guides, when they are searched for a name from the pool, then each use belongs to a named person listed for that key", () => {
    const listed = new Set(everyNamed().flatMap((person) => person.keys.map((key) => `${key} ${person.name}`)));
    const scanned = Object.fromEntries(
      Object.entries(textTables)
        .filter(([file]) => !["place", "guide", "personNames"].includes(file))
        .flatMap(([, table]) => Object.entries(table)),
    );
    const names = namePool.map((entry) => nameOf(entry.n)).filter((name) => !ALSO_WORDS.includes(name));
    expect(namesUsed(scanned, names).filter((use) => !listed.has(use))).toEqual([]);
  });

  test("[person:computer-names-generated] [text:family-group-feed] given the family names, when each is looked up, then it is a pool name from the family's own people", () => {
    const wrong = Object.entries(familyNames).flatMap(([life, names]) =>
      Object.values(names ?? {}).filter((name) => poolByName.get(name)?.people !== familyPeople[life as keyof typeof familyPeople]).map((name) => `${life} ${name}`),
    );
    expect(wrong).toEqual([]);
  });

  test("[person:computer-names-generated] given everyone the words name, when they are counted by people, then they come from enough peoples and the two largest do not take over (names rule 2)", () => {
    expect(namedMixProblems(everyNamed(), namedMix)).toEqual([]);
  });

  test("[person:computer-names-generated] given the named people drifted back to two peoples, when they are counted, then the check fails", () => {
    const drifted = everyNamed().map((person, index): NamedPerson => ({ ...person, people: index % 2 === 0 ? "igbo" : "yoruba" }));
    expect(namedMixProblems(drifted, namedMix)).toHaveLength(2);
    // At the edges: the two largest at exactly the share allowed pass and one more fails; one people short of the floor fails.
    const others = PEOPLES.filter((people) => people !== "igbo" && people !== "yoruba");
    const spread = (igbo: number, yoruba: number, rest: number, peoples: readonly NamePeople[] = others): NamedPerson[] => [
      ...Array.from({ length: igbo }, (): NamedPerson => ({ name: "Chidi", people: "igbo", role: "friend", keys: [] })),
      ...Array.from({ length: yoruba }, (): NamedPerson => ({ name: "Kemi", people: "yoruba", role: "friend", keys: [] })),
      ...Array.from({ length: rest }, (_, index): NamedPerson => ({ name: "Ebi", people: peoples[index % peoples.length]!, role: "friend", keys: [] })),
    ];
    expect(namedMixProblems(spread(6, 6, 12), namedMix)).toEqual([]);
    expect(namedMixProblems(spread(7, 6, 11), namedMix)).toEqual(["the two largest peoples hold 13 of 24 named people, over 5000 basis points"]);
    expect(namedMixProblems(spread(2, 2, 6, others.slice(0, namedMix.minPeoples - 2)), namedMix)).toEqual([]);
    expect(namedMixProblems(spread(2, 2, 6, others.slice(0, namedMix.minPeoples - 3)), namedMix)).toEqual([`the named people come from ${String(namedMix.minPeoples - 1)} peoples, fewer than ${String(namedMix.minPeoples)}`]);
  });

  test("[person:computer-names-generated] given the ready lives' families, when their peoples are read, then they cover the three largest peoples and at least one other (names rule 3)", () => {
    const peoples = new Set(Object.values(familyPeople));
    expect([...peoples].filter((people) => ["yoruba", "igbo", "hausa-fulani"].includes(people)).sort()).toEqual(["hausa-fulani", "igbo", "yoruba"]);
    expect(peoples.size).toBeGreaterThanOrEqual(4);
    expect(Object.keys(familyPeople).sort()).toEqual(Object.keys(content.scenario).filter((id) => id !== "scenario.prologue").sort());
  });

  test("[person:computer-names-generated] [person:names-predict-nothing] given who holds which role, when they are read by people, then no people holds two roles that take money and no role is held only by one people (names rule 5)", () => {
    expect(roleProblems(everyNamed())).toEqual([]);
    const agents = everyNamed().map((person) => (person.role === "agent" ? { ...person, people: "igbo" as const } : person));
    expect(roleProblems(agents)).toEqual(["igbo holds Kunle (agent) and Ameh (agent)", "every agent is igbo"]);
    const taking = everyNamed().map((person) => (person.role === "fx" || person.role === "landlord" ? { ...person, people: "tiv" as const } : person));
    expect(roleProblems(taking)).toEqual(["tiv holds Ochai (fx) and Ovie (landlord)"]);
  });
});

describe("cultural institutions", () => {
  test("[person:computer-names-generated] [person:no-institution-tied-to-crime] given every word in the game, when an institution is named, then no crime or fraud is named beside it (names rule 7)", () => {
    expect(institutionProblems(text)).toEqual([]);
  });

  test("[person:computer-names-generated] [person:no-institution-tied-to-crime] given words that put a masquerade, a palace or a church beside a crime, when they are checked, then each is found", () => {
    const made = {
      "a.masquerade": "Men dressed as a masquerade robbed the bus.",
      "a.palace": "The palace covered for the fraud.",
      "a.church": "The church van smuggled it through.",
      "a.plain": "The church van goes to Naples on Saturday.",
    };
    expect(institutionProblems(made)).toEqual(["a.masquerade", "a.palace", "a.church"]);
  });
});
