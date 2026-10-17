// Where the life is from, on the page and the family card (prologue.md R-PROLOGUE-009, R-PROLOGUE-014): the page prints FROM beside FAMILY as its card turns over, the card's title says
// "Family from" the town with its means a tag, and the child of the water is from Lagos. Real content, real draws.
import { act } from "@testing-library/react";
import { content } from "@japacity/content";
import { afterEach, describe, expect, test, vi } from "vitest";

import { keepPerson } from "../../authority/person";
import { TRAIL_KEY } from "../../shared/datapage/family";
import { archetypeOf, doorAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { hometownWords, say } from "../../shared/words/text";
import { PageHandover, TURN_MS } from "./PrologueView";

const PROLOGUE = "scenario.prologue";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

/** Plays a tile on one seed on the engine alone: its preset answers while allowed, else the answer that suits it. */
function play(id: string, seed: string): ReturnType<typeof newGame> {
  const archetype = archetypeOf(id);
  if (archetype === null) throw new Error(`No ${id} tile.`);
  const game = newGame(PROLOGUE, seed);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const open = doorAnswer(archetype, prologue);
    if (open === null) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open });
  }
  return game;
}

/** The handover for a tile's life, its draw kept on the device as the run keeps it, after the family has turned over. */
async function handover(id: string, seed: string): Promise<ReturnType<typeof newGame>> {
  keepPerson({ look: "chr_ada", name: "Ada", archetype: id });
  const game = play(id, seed);
  localStorage.setItem(TRAIL_KEY, JSON.stringify({ draw: game.state.prologue.draw, steps: [] }));
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await renderWithView(<PageHandover onDone={() => undefined} />, game.view());
  act(() => {
    vi.advanceTimersByTime(TURN_MS + 10);
  });
  return game;
}

const field = (id: string): string | null => document.querySelector(`[data-page] [data-field='${id}']`)?.textContent ?? null;

describe("where the life is from, on the handover", () => {
  test("[R-PROLOGUE-009] [R-PROLOGUE-014] given a tile's life handed over, when its family turns over, then the card says Family from the town the view names, the means stand as a tag beside the others, and the page prints FROM that town beside FAMILY in its means", async () => {
    const game = await handover("developer", "hometown-page-0");
    const hometown = game.view().hometown;
    expect(hometown).not.toBeNull();
    const town = say(`${hometown!}.name`);
    expect(content.tuning.prologue.hometowns.city.concat(content.tuning.prologue.hometowns.town)).toContain(hometown);
    expect(document.querySelector("[data-family-title]")?.textContent).toBe(say("ui.page.family.from", { hometown: town }));
    expect(document.querySelector("[data-family-title]")?.textContent).toBe(`Family from ${town}`);
    const tags = [...document.querySelectorAll("[data-family-tags] > *")].map((tag) => tag.textContent);
    const means = ["low", "middle", "high"].map((band) => say(`ui.page.family.${band}`));
    expect(tags.filter((tag) => means.some((words) => tag?.includes(words)))).toHaveLength(1);
    expect(field("from")).toBe(`${say("ui.page.field.from")}${town}`);
    expect(means.some((words) => field("family") === `${say("ui.page.field.family")}${words}`)).toBe(true);
    // FROM stands before FAMILY in the row under the photo, and READY after both.
    const order = [...document.querySelectorAll<HTMLElement>("[data-page] [data-field]")].map((one) => one.dataset["field"]);
    expect(order.slice(order.indexOf("from"))).toEqual(["from", "family", "ready"]);
    // The strip carries what the page's rule names, never the town (R-PROLOGUE-009).
    expect(document.querySelector("[data-page-strip]")?.textContent).not.toContain(town.toUpperCase().replace(/[^A-Z]/g, "<"));
  });

  test("[R-PROLOGUE-009] [R-PROLOGUE-012] [R-PROLOGUE-014] given the child of the water handed over, then it is from Lagos, its card still the house on stilts in Makoko", async () => {
    const game = await handover("water", "hometown-water-0");
    expect(game.view().hometown).toBe("hometown.lagos");
    expect(document.querySelector("[data-family-title]")?.textContent).toBe(say("ui.page.family.water"));
    expect(field("from")).toBe(`${say("ui.page.field.from")}${hometownWords("hometown.lagos")}`);
    expect(field("from")).toContain("Lagos");
  });
});
