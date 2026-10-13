// Who says a line overheard (docs/rules/world.md R-WORLD-026, as the small items wave amends it): a line one person
// plainly says carries their name beside it, `<place>.overheard.<n>.by`, and the bubble over them says that name instead
// of "Someone nearby". A name is a person a player would call them, in a few words, never the engine's counting.
import { describe, expect, test } from "vitest";

import { text } from "../index";

const BY = /^(place\.[a-z0-9-]+\.overheard\.[0-9]+)\.by$/;
const named = Object.entries(text).flatMap(([key, name]) => {
  const line = BY.exec(key)?.[1];
  return line === undefined ? [] : [{ key, line, name }];
});

/** What a player must never read, as the client's words scan holds it (text.md R-TEXT-005). */
const NEVER = /\b(slots?|banked|days left|chapters?|turns?|pages?|someone|somebody|nobody)\b|%|[0-9]/i;

describe("who says a line overheard", () => {
  test("[R-WORLD-026] given every line's .by, when it is read, then it stands beside a line that exists and names a person in at most two words, capitalised, with no sentence's stop, figure or engine word", () => {
    expect(named.length).toBeGreaterThanOrEqual(30);
    const wrong = named.filter(({ line, name }) => {
      const words = name.split(" ");
      return text[line] === undefined || words.length > 2 || !/^[A-Z]/.test(name) || /[.,:;!?"“”'()]/.test(name) || NEVER.test(name);
    });
    expect(wrong).toEqual([]);
  });

  test("[R-WORLD-026] given the family house's three lines, when their speakers are read, then a brother says Papa is asking about the gate, Mama says the uncle called, and a sister says Mama kept food in the pot", () => {
    expect(text["place.family-house.overheard.1.by"]).toBe("Your brother");
    expect(text["place.family-house.overheard.2.by"]).toBe("Mama");
    expect(text["place.family-house.overheard.3.by"]).toBe("Your sister");
  });

  test("[R-WORLD-026] given a conductor calling the next stop, when the line is read, then the conductor says it; and a line with a stop called twice is always a conductor's", () => {
    expect(text["place.ojuelegba.overheard.1"]).toMatch(/^Oshodi, Oshodi\./);
    expect(text["place.ojuelegba.overheard.1.by"]).toBe("Conductor");
    // "Ikeja, Ikeja.", "Ojota, Ojota.": a stop called twice at the head of a line is the conductor's call.
    const calls = Object.keys(text).filter((key) => /^place\.[a-z0-9-]+\.overheard\.[0-9]+$/.test(key) && /^([A-Z][a-z]+), \1\b/.test(text[key] ?? ""));
    expect(calls.length).toBeGreaterThanOrEqual(10);
    expect(calls.filter((key) => text[`${key}.by`] !== "Conductor")).toEqual([]);
  });

  test("[R-WORLD-026] given the homes' lines, when their speakers are read, then a speaker is named only where one person plainly speaks, and a line with no .by keeps the house's or the street's own voice", () => {
    // "Next door: " already says who speaks, so no name stands over it twice.
    expect(text["place.compound-room.overheard.2"]).toMatch(/^Next door: /);
    expect(text["place.compound-room.overheard.2.by"]).toBeUndefined();
    for (const n of [1, 2, 3]) expect(text[`place.hostel-room.overheard.${String(n)}.by`]).toBe("Hostel mate");
    // The rota and the landlord's rule are the compound's talk, said by nobody in particular.
    expect(text["place.compound-room.overheard.1.by"]).toBeUndefined();
    expect(text["place.compound-room.overheard.4.by"]).toBeUndefined();
  });
});
