// Look in the box says what is in it (docs/rules/world.md R-WORLD-019), as Japa's Papers screen does.
import { describe, expect, test } from "vitest";

import { nameOf, runningName } from "../../shared/words/text";
import { cityWords, papersLook } from "./city.words";

const PASSPORT = "document.passport";
const TRANSCRIPT = "document.transcript";

describe("the papers box", () => {
  test("[R-WORLD-019] given no paper held, when the box is looked in, then it says the box is empty, never that all is in it", () => {
    expect(papersLook([])).toBe(cityWords("city.act.papers.empty"));
    expect(papersLook([{ id: PASSPORT, state: "pending" }])).toBe(cityWords("city.act.papers.empty"));
    expect(papersLook([{ id: PASSPORT, state: "pending" }])).not.toMatch(/All in the box/);
  });

  test("[R-WORLD-019] given some papers held and one on its way, when the box is looked in, then it names only the ones held", () => {
    const told = papersLook([
      { id: PASSPORT, state: "held" },
      { id: TRANSCRIPT, state: "pending" },
    ]);
    expect(told).toBe(cityWords("city.act.papers.some", { papers: runningName(PASSPORT) }));
    expect(told).not.toContain(runningName(TRANSCRIPT));
  });

  test("[R-WORLD-019] given every paper held, when the box is looked in, then it names them all and says all is in the box", () => {
    const told = papersLook([
      { id: PASSPORT, state: "held" },
      { id: TRANSCRIPT, state: "held" },
    ]);
    expect(told).toBe(cityWords("city.act.papers.all", { papers: cityWords("city.act.papers.and", { first: nameOf(PASSPORT), last: runningName(TRANSCRIPT) }) }));
  });

  test("[R-WORLD-019] given the line the City shows today with no state passed, then it claims nothing about what is in the box", () => {
    expect(cityWords("city.act.papers.done")).not.toMatch(/All in the box|empty/);
  });
});
