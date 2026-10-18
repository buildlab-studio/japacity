// The bed's month end, the player's own figure and a thing's fan over the world (docs/rules/world.md R-WORLD-025,
// R-WORLD-008, R-WORLD-005, R-WORLD-003, R-WORLD-014). The bed's Sleep
// ends the month once its timed sleep runs out, and the results open in the room; the phone's lock screen does not come
// first (R-WORLD-025). A tap on your own figure opens nothing. A fan hides the nudge only while it is open: a tap anywhere
// outside it, Escape or its sheet's close puts it away and the nudge comes back by itself; a person's or a shopfront's
// card does the same and sits at the foot of the screen. A reload opens inside the house when the player last stopped
// there. The place file is the one
// the game ships; the scene is a stand-in that hands the city the taps a player makes.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/person";
import { plannable } from "../../shared/words/acts";
import { City, RESULTS_BEAT_MS } from "./City";
import { SLEEP_MS } from "./acts/sleep";
import { pressFanActNow } from "./fan/fan.testing";


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
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

/** Ada at home with a month behind her and something planned. */
async function adaAtHome(extra: Partial<Parameters<typeof City>[0]> = {}, goIn = true) {
  // At the family house unless the test opens elsewhere (R-WORLD-014: the game opens where the player last stopped).
  if (goIn) window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
  const game = newGame("scenario.ada");
  game.endTurn();
  const rendered = await renderWithGame(
    <City world results={(place) => <p data-results-for={place} />} phone={(close) => <button type="button" data-stand-in-phone onClick={close} />} {...extra} />,
    game,
  );
  // The house opens whole, the bed in your corner.
  await waitFor(() => found('[data-stand-in-thing="mattress"]'), { timeout: 3000 });
  const pick = game.view().activities.find((option) => option.allowed && option.affordable && option.id !== "activity.job-hunt" && option.params === null && plannable(option.id));
  if (pick === undefined) throw new Error("Nothing Ada can plan.");
  act(() => {
    rendered.store.getState().addToPlan({ activity: pick.id, param: null });
  });
  expect(rendered.store.getState().plan.some((one) => one !== null)).toBe(true);
  return rendered;
}

const nudge = (): Element | null => document.querySelector("[data-nudge]");

describe("the bed's month end", () => {
  // The bed never opens the phone before the turn (R-WORLD-025). On the timed sleep nothing is sent at the tap, then
  // turn/end goes once with the plan as it stands, and the results open in the room.
  test("[R-WORLD-025] [R-WORLD-008] given something planned at home, when the bed's Sleep is tapped, then the phone stays shut and nothing is sent until the sleep runs out; then the month ends with the plan's commitments and the results sheet opens over the place", async () => {
    const bed = await adaAtHome();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    pressFanActNow("mattress", "end-month");
    expect(document.querySelector("[data-stand-in-phone]")).toBeNull();
    expect(bed.authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(0);
    const slots = bed.store.getState().plan.filter((one) => one !== null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLEEP_MS);
    });
    expect(bed.authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(1);
    expect(bed.authority.sent.find((command) => command.type === "turn/end")).toMatchObject({ type: "turn/end", slots });
    expect(document.querySelector("[data-stand-in-phone]")).toBeNull();
    expect(bed.store.getState().reportOpen).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULTS_BEAT_MS + 1500);
    });
    expect(found("[data-results-for]").dataset.resultsFor).toBeTruthy();
  });
});

describe("the player's own figure", () => {
  test("[R-WORLD-005] [R-WORLD-003] given the world, when the player's own figure is tapped, then nothing opens, no card and no dialog, nothing is sent and the nudge stays", async () => {
    const { authority } = await adaAtHome();
    expect(nudge()).not.toBeNull();
    const before = authority.sent.length;
    fireEvent.click(found("[data-stand-in-own]"));
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(authority.sent).toHaveLength(before);
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-005] [R-WORLD-003] given a thing's fan open, when the player's own figure is tapped, then the fan goes and the nudge comes back", async () => {
    await adaAtHome();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    expect(nudge()).toBeNull();
    fireEvent.click(found("[data-stand-in-own]"));
    expect(nudge()).not.toBeNull();
  });
});

describe("a thing's fan and the nudge", () => {
  test("[R-WORLD-003] given a thing's fan open, when a tap lands anywhere outside it, then the fan goes and the nudge comes back by itself, with no tap on the floor", async () => {
    await adaAtHome();
    expect(nudge()).not.toBeNull();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    // The nudge hides while the fan is open.
    expect(nudge()).toBeNull();
    // A tap on the band, outside the fan.
    fireEvent.pointerDown(found("[data-band]"));
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-003] [R-WORLD-034] given a thing's fan open, when Escape (Back) is pressed, then the fan goes and the nudge comes back; a tap inside the fan keeps it", async () => {
    await adaAtHome();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    expect(nudge()).toBeNull();
    // A tap on the fan itself keeps it open.
    fireEvent.pointerDown(found('[data-fan="mama"] [data-fan-act] button'));
    expect(nudge()).toBeNull();
    expect(document.querySelector('[data-fan="mama"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-003] [R-WORLD-034] given a thing's act that opens its sheet, when the sheet is closed, then the nudge comes back by itself", async () => {
    await adaAtHome();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    const mama = document.querySelector<HTMLElement>('[data-fan="mama"] [data-fan-act] button');
    if (mama === null) throw new Error("Mama has no act.");
    fireEvent.click(mama);
    expect(nudge()).toBeNull();
    const sheet = await waitFor(() => found("[role=dialog]"));
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("[role=dialog]")).toBeNull());
    expect(nudge()).not.toBeNull();
  });
});

describe("a person's or a shopfront's card", () => {
  test("[R-WORLD-005] [R-WORLD-003] given a shopfront's card open, when it shows, then it sits at the foot of the screen as the sheets do, never under the band; a tap anywhere outside it closes it and the nudge comes back", async () => {
    await adaAtHome();
    fireEvent.click(found("[data-stand-in-shopfront]"));
    const card = found("[data-card]");
    expect(card.closest("[data-card-dock]")).not.toBeNull();
    expect(card.closest("[data-band]")).toBeNull();
    expect(found("[data-card-dock]").className).toContain("bottom-0");
    expect(nudge()).toBeNull();
    // A tap inside the card keeps it.
    fireEvent.pointerDown(card);
    expect(document.querySelector("[data-card]")).not.toBeNull();
    fireEvent.pointerDown(found("[data-band]"));
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-005] [R-WORLD-003] given a person's card open, when Escape (Back) is pressed, then it closes and the nudge comes back", async () => {
    await adaAtHome();
    fireEvent.click(found("[data-stand-in-person]"));
    expect(found("[data-card]").closest("[data-card-dock]")).not.toBeNull();
    expect(nudge()).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(nudge()).not.toBeNull();
  });
});

describe("where the game opens", () => {
  // The family house is one wide floor with no yard and parlour apart, so the room behind a door is the hub's at
  // Ojuelegba, and the family house opens whole.
  test("[R-WORLD-014] given the player last stopped inside the hub's room at Ojuelegba, when the world opens again, then it opens inside, at the desks, not on the street", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.ojuelegba", "inside"]));
    const game = newGame("scenario.ada");
    game.endTurn();
    await renderWithGame(<City world results={() => <p />} />, game);
    await waitFor(() => found('[data-stand-in-thing="desk"]'), { timeout: 3000 });
    expect(document.querySelector('[data-stand-in-thing="hub"]')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("japacity.city.last") ?? "[]")).toEqual(["place.ojuelegba", "inside"]);
  });

  test("[R-WORLD-014] given the player last stopped on Ojuelegba's street, when the world opens again, then it opens on the street", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.ojuelegba"]));
    const game = newGame("scenario.ada");
    game.endTurn();
    await renderWithGame(<City world results={() => <p />} />, game);
    await waitFor(() => found('[data-stand-in-thing="hub"]'), { timeout: 3000 });
    expect(document.querySelector('[data-stand-in-thing="desk"]')).toBeNull();
  });

  test("[R-WORLD-014] given the player last stopped at the family house, when the world opens again, then the house opens whole, its bed and Mama there at once, with no door to go in by", async () => {
    await adaAtHome();
    expect(document.querySelector('[data-stand-in-thing="mama"]')).not.toBeNull();
    expect(document.querySelector('[data-stand-in-thing="house"]')).toBeNull();
  });
});
