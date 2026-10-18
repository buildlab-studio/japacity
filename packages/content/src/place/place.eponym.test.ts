// Public places named after a person (city.md R-CITY-006): the place keeps its public name, and the person is never in the
// game. Every text the game shows is walked: the person's name appears only as the place, with its road word, after a word
// of where ("on", "off", "at"), or alone as the place's short name.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

/** Each public place named after a person, with the person's name as the place's own name carries it. */
const NAMED_AFTER: readonly { place: string; person: string }[] = [
  { place: "place.bode-thomas", person: "Bode Thomas" },
  { place: "place.adeniran-ogunsanya", person: "Adeniran Ogunsanya" },
  { place: "place.herbert-macaulay-way", person: "Herbert Macaulay" },
  { place: "place.tafawa-balewa-square", person: "Tafawa Balewa" },
  { place: "place.airport-lagos", person: "Murtala Muhammed" },
];

const PLACE_WORD = /^\s*(street|way|square|avenue|road|international airport|intl airport)\b/i;
const WHERE_WORD = /\b(on|off|at|along|by|to|from|near|past|in|via)\s*$/i;

/** Each use of the person's name in a text that is not the place. */
function personUses(words: string, person: string): number[] {
  const found: number[] = [];
  const lower = words.toLowerCase();
  const name = person.toLowerCase();
  for (let at = lower.indexOf(name); at !== -1; at = lower.indexOf(name, at + 1)) {
    const after = words.slice(at + name.length);
    const before = words.slice(0, at);
    const alone = words.trim().toLowerCase() === name;
    if (!alone && !PLACE_WORD.test(after) && !WHERE_WORD.test(before)) found.push(at);
  }
  return found;
}

describe("a public place named after a person", () => {
  test("[R-CITY-006] given each place named after a person, when its entry is read, then it is public and keeps the real name the sign carries", () => {
    for (const { place, person } of NAMED_AFTER) {
      const entry = Object.values(content.place).find((one) => one.id === place);
      expect({ place, kind: entry?.nameKind, keeps: entry?.realName?.includes(person), shown: text[`${place}.name`] }).toEqual({ place, kind: "public", keeps: true, shown: entry?.realName });
    }
  });

  test("[R-CITY-006] given every text in the game, when it names the person a place is named after, then it names the place, never the person", () => {
    const misuses = Object.entries(text).flatMap(([key, words]) =>
      NAMED_AFTER.filter(({ person }) => personUses(words, person).length > 0).map(({ person }) => `${key}: ${person} in "${words}"`),
    );
    expect(misuses).toEqual([]);
  });

  test("[R-CITY-006] given the check, when a text speaks of the person, then it is caught", () => {
    expect(personUses("Murtala Muhammed led the country in 1975.", "Murtala Muhammed")).toHaveLength(1);
    expect(personUses("As Herbert Macaulay said, the city is ours.", "Herbert Macaulay")).toHaveLength(1);
    expect(personUses("A flat off Bode Thomas, two floors up", "Bode Thomas")).toEqual([]);
    expect(personUses("MURTALA MUHAMMED\nINTL AIRPORT", "Murtala Muhammed")).toEqual([]);
  });
});
