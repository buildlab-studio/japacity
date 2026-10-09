// The archetypes' sheet as a first-time player meets it (prologue.md R-PROLOGUE-009, 010):
// the ready lives in reach above the six tiles, and each tile its own age.
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

describe("the archetypes' sheet", () => {
  test("[R-PROLOGUE-009] [R-PROLOGUE-010] given the sheet of what you did, then the ready lives' row comes before the six tiles, and each tile says the age its life hands over at", async () => {
    render(<App store={bootGame({ storage: memoryStorage(), fastClock: true, makeSeed: () => "front-door-layout" })} />);
    await toTheArchetypes();
    const ready = document.querySelector("[data-ready-card]");
    const tiles = document.querySelector("[data-archetypes]");
    if (ready === null || tiles === null) throw new Error("No ready row or no tiles.");
    expect(ready.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ready.textContent).toContain(say("ui.door.ready"));
    for (const archetype of ARCHETYPES) {
      expect(document.querySelector(`[data-archetype='${archetype.id}']`)?.textContent).toMatch(/Hands over at about \d+/);
    }
  });
});
