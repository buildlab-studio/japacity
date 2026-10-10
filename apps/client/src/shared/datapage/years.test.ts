// The age the data page prints before a life begins (prologue.md R-PROLOGUE-004, 009, 010; decision 0023): a tile's own
// year, the one its tile says it hands over from, and a ready life's own, each a true number.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { ARCHETYPES } from "../frontdoor/archetypes";
import { say } from "../words/text";
import { startYearFor } from "./age";
import { readyMonths, yearsOf } from "./years";

describe("the page's age before a life begins", () => {
  test("[R-PROLOGUE-004] [R-PROLOGUE-009] given every tile, then the page's age at the tile's own is the one its tile says it hands over from", () => {
    for (const archetype of ARCHETYPES) {
      const said = Number(/at (\d+)/.exec(say(`prologue.archetype.${archetype.id}.opens`))?.[1] ?? -1);
      expect({ [archetype.id]: startYearFor(archetype, 0) }).toEqual({ [archetype.id]: said });
    }
  });

  test("[R-PROLOGUE-009] given a ready life, then the page's age is its own, in the birthdays passed", () => {
    for (const id of Object.keys(content.scenario) as Id<"scenario">[]) {
      if (content.scenario[id]?.prologue === true) continue;
      expect(readyMonths(id)).toBe(content.scenario[id]?.qualities["quality.age-months"]);
    }
    expect(yearsOf(23 * 12 + 11)).toBe(23);
    expect(yearsOf(24 * 12)).toBe(24);
  });
});
