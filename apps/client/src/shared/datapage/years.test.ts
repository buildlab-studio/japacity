// The age the data page prints before a life begins (prologue.md R-PROLOGUE-009, 010): a tile's own age, the one its
// tile says it hands over at, and a ready life's own.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { ARCHETYPES } from "../frontdoor/archetypes";
import { say } from "../words/text";
import { aboutYears, middleMonths, readyMonths } from "./years";

describe("the page's age before a life begins", () => {
  test("[R-PROLOGUE-009] given every tile, then the page's age is the one its tile says it hands over at", () => {
    for (const archetype of ARCHETYPES) {
      const said = Number(/about (\d+)/.exec(say(`prologue.archetype.${archetype.id}.opens`))?.[1] ?? -1);
      expect({ [archetype.id]: aboutYears(middleMonths(archetype)) }).toEqual({ [archetype.id]: said });
    }
  });

  test("[R-PROLOGUE-009] given a ready life, then the page's age is its own", () => {
    for (const id of Object.keys(content.scenario) as Id<"scenario">[]) {
      if (content.scenario[id]?.prologue === true) continue;
      expect(readyMonths(id)).toBe(content.scenario[id]?.qualities["quality.age-months"]);
    }
  });
});
