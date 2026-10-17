// The second screen as a first-time player meets it (prologue.md R-PROLOGUE-010, 013), as the
// door draws it: the lives as big sticker cards with the first chosen, each with its tag as a tilted
// chip, its thing and your face, its name, the life in a few words, the one line of what it was and its savings, and
// under the cards the chosen life's routes as picture chips; the full line of what it opens and the age it starts at
// is read out with the card; the age under them, and no ready life.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "../../App";
import { bootGame } from "../../authority/boot";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { ARCHETYPES, opensChips, savingsOf } from "./archetypes";
import { toTheArchetypes } from "./frontDoor.testing";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

describe("Your life so far", () => {
  test("[R-PROLOGUE-010] [R-PROLOGUE-013] given the second screen, then no ready life is on it, the tiles come first with the first chosen, each tile says its tag, what it was, the routes it opens and the age it hands over from, and the age stands under them", async () => {
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
      const field = (mark: string): string | null => tile.querySelector(`[${mark}]`)?.textContent ?? null;
      expect(field("data-tile-tag")).toBe(say(`ui.door.tag.${archetype.id}`));
      expect(field("data-tile-name")).toBe(say(`prologue.archetype.${archetype.id}.name`));
      // The life in a few words, from content.
      expect(field("data-tile-life")).toBe(say(`prologue.archetype.${archetype.id}.life`));
      expect(say(`prologue.archetype.${archetype.id}.life`).split(" ").length).toBeLessThanOrEqual(4);
      expect(field("data-tile-was")).toBe(say(`prologue.archetype.${archetype.id}.was`));
      expect(field("data-tile-savings")).toBe(say("ui.door.tile.savings", { amount: formatMoney(savingsOf(archetype), "NGN") }));
      // The card says those and nothing else; its thing and your face are pictures.
      expect(tile.textContent).toBe(`${say(`ui.door.tag.${archetype.id}`)}${say(`prologue.archetype.${archetype.id}.name`)}${say(`prologue.archetype.${archetype.id}.life`)}${say(`prologue.archetype.${archetype.id}.was`)}${say("ui.door.tile.savings", { amount: formatMoney(savingsOf(archetype), "NGN") })}`);
      expect(opensChips(archetype.id).length).toBeGreaterThan(0);
      // The age its path reaches with no setback (R-PROLOGUE-004): a true number, never "about", read out with the card.
      expect(tile.getAttribute("aria-description")).toBe(say(`prologue.archetype.${archetype.id}.opens`));
      expect(tile.getAttribute("aria-description")).toMatch(/Opens: .+Starts at \d+, or older$/);
    }
    // Under the cards, the chosen life's routes as chips, each with its words; one set only.
    expect(document.querySelectorAll("[data-tile-opens]")).toHaveLength(1);
    expect([...document.querySelectorAll("[data-tile-opens] [data-sticker-chip] [data-way]")].map((chip) => chip.textContent)).toEqual(opensChips(ARCHETYPES[0]!.id));
    expect(tiles.compareDocumentPosition(document.querySelector("[data-tile-opens]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(new Set(ARCHETYPES.map((archetype) => say(`ui.door.tag.${archetype.id}`)))).toEqual(new Set(["Balanced", "Head start", "Money first", "Hard start"]));
  });
});
