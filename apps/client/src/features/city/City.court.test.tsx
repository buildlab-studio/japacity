// The answer once courted, in the world (docs/rules/people.md R-PEOPLE-013, R-PEOPLE-054; world.md R-WORLD-020): once
// "Start seeing Tobi" closes the sheet and Tobi leaves the parlour, the corner tells the person's own line, and it waits
// for the corner to show, so the home's card never hides it. The place files are the ones the game ships; the scene is
// a stand-in that hands the city a tap on a thing's act.
import { text } from "@japacity/content";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { peopleGame, renderWithGame, TOBI } from "../../shared/testing/people";
import { nameOf, say } from "../../shared/words/text";
import { TOLD_MS } from "../../shared/world/Lines";
import { City } from "./City";

// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (R-WORLD-034).
vi.mock("./scene/CityScene", async () => ({ default: (await import("./fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => {
  const real = await original<typeof import("../../shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "..", "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

beforeEach(() => {
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  // Inside the family house, where the people met after the service come home with the family.
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});

describe("the answer once courted", () => {
  test("[R-PEOPLE-013] [R-PEOPLE-054] [R-WORLD-020] given Tobi in the parlour and the home's card still up, when he is courted, then the corner waits for the card to be put away and tells his answer in his own words, then that he lives in the game", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const game = peopleGame();
    game.grant(1);
    game.endTurn([]);
    const { authority } = await renderWithGame(<City world results={() => <p />} />, game);
    // The family house opens whole, its parlour with it.
    const tobi = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-stand-in-thing="after-service"]');
      if (found === null) throw new Error(`Tobi is not standing in the parlour. ${document.querySelector("[data-city]")?.getAttribute("data-city") ?? "no city"} ${[...document.querySelectorAll<HTMLElement>("[data-stand-in-thing]")].map((one) => one.dataset.standInThing).join(",")}`);
      return found;
    });
    // The home's card, once in a life (R-HOME-008), is still up: the player goes straight to Tobi.
    expect(document.querySelector("[data-home-teach-ok]")).not.toBeNull();
    // His fan's Talk (R-WORLD-034).
    fireEvent.click(tobi);
    fireEvent.click(await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-fan="after-service"] [data-fan-act="talk"] button');
      if (found === null) throw new Error("Tobi's fan has no Talk.");
      return found;
    }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(say("ui.people.court", { name: nameOf(TOBI) })) }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "people/court", with: TOBI }));
    const answer = say("ui.people.courted.said", { name: nameOf(TOBI), line: text[`${TOBI}.courted`]! });
    // The home's card covers the corner: the answer waits for it.
    await waitFor(() => expect(document.querySelector("[data-home-teach]")).not.toBeNull());
    expect(document.querySelector("[data-corner]")?.textContent ?? "").not.toContain(answer);
    // However long the card stays up, the answer is still told once it is put away.
    act(() => {
      vi.advanceTimersByTime(TOLD_MS * 2);
    });
    act(() => document.querySelector<HTMLElement>("[data-home-teach-ok]")?.click());
    // One line at a time in the corner (the talk budget): his answer first, then that he lives in the game.
    await waitFor(() => expect(document.querySelector("[data-corner]")?.textContent).toContain(answer));
    act(() => {
      vi.advanceTimersByTime(TOLD_MS);
    });
    expect(document.querySelector("[data-corner]")?.textContent).toContain(say("ui.people.chosen", { name: nameOf(TOBI) }));
  });
});
