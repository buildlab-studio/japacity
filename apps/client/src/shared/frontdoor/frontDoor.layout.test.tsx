// The second screen as a first-time player meets it (prologue.md R-PROLOGUE-010, 013): the
// tiles with the first chosen, each with its tag, its own age and the routes it opens in words, the age under them,
// and no ready life (they are behind Settings).
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { bootGame } from "../../authority/boot";
import { say } from "../words/text";
import { ARCHETYPES } from "./archetypes";
import { toTheArchetypes } from "./frontDoor.testing";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

describe("Your life so far", () => {
  test("[R-PROLOGUE-010] [R-PROLOGUE-013] given the second screen, then no ready life is on it, the tiles come first with the first chosen, each tile says its tag, what it was, the routes it opens and the age it hands over at, and the age stands under them", async () => {
    render(<App store={bootGame({ storage: memoryStorage(), fastClock: true, makeSeed: () => "front-door-layout" })} />);
    await toTheArchetypes();
    expect(document.querySelector("[data-ready-card], [data-ready], [data-ready-entry]")).toBeNull();
    expect(document.body.textContent).not.toContain(say("ui.door.ready"));
    const tiles = document.querySelector("[data-archetypes]");
    const age = document.querySelector("[data-door-age]");
    if (tiles === null || age === null) throw new Error("No tiles or no age.");
    expect(tiles.compareDocumentPosition(age) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const [at, archetype] of ARCHETYPES.entries()) {
      const tile = document.querySelector<HTMLElement>(`[data-archetype='${archetype.id}']`)!;
      expect(tile.getAttribute("aria-checked")).toBe(at === 0 ? "true" : "false");
      expect([...tile.children].map((line) => line.textContent)).toEqual([say(`ui.door.tag.${archetype.id}`), say(`prologue.archetype.${archetype.id}.name`), say(`prologue.archetype.${archetype.id}.was`), say(`prologue.archetype.${archetype.id}.opens`)]);
      expect(tile.textContent).toMatch(/Opens: .+Hands over at about \d+/);
    }
    expect(new Set(ARCHETYPES.map((archetype) => say(`ui.door.tag.${archetype.id}`)))).toEqual(new Set(["Balanced", "Head start", "Money first", "Hard start"]));
  });
});
