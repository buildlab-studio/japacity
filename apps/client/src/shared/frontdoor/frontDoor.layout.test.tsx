// The second screen as a first-time player meets it (prologue.md R-PROLOGUE-010, 013), as the
// design lab draws it: the tiles as single rows with the first chosen, each with its name in bold and its tag at the
// right, the one line of what it was, its savings, and on the chosen row the routes it opens as chips; the full line
// of what it opens and the age it hands over from is read out with the row; the age under them, and no ready life.
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
      const lines = [...tile.children].map((line) => line.textContent);
      const head = [`${say(`prologue.archetype.${archetype.id}.name`)}${say(`ui.door.tag.${archetype.id}`)}`, say(`prologue.archetype.${archetype.id}.was`), say("ui.door.tile.savings", { amount: formatMoney(savingsOf(archetype), "NGN") })];
      expect(lines).toEqual(at === 0 ? [...head, opensChips(archetype.id).map((way) => ` ${way}`).join("")] : head);
      expect(tile.querySelector("[data-tile-tag]")?.textContent).toBe(say(`ui.door.tag.${archetype.id}`));
      expect(opensChips(archetype.id).length).toBeGreaterThan(0);
      // The age its path reaches with no setback (R-PROLOGUE-004): a true number, never "about", read out with the row.
      expect(tile.getAttribute("aria-description")).toBe(say(`prologue.archetype.${archetype.id}.opens`));
      expect(tile.getAttribute("aria-description")).toMatch(/Opens: .+Hands over from \d+$/);
    }
    expect(new Set(ARCHETYPES.map((archetype) => say(`ui.door.tag.${archetype.id}`)))).toEqual(new Set(["Balanced", "Head start", "Money first", "Hard start"]));
  });
});
