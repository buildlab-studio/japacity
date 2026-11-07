// An act that repeats, at its thing (activity:acts-may-repeat-in-month, activity:now-acts-spend-half-days; decision 0012): time with
// Mama answers at once each time it is asked for. Her sheet, which holds her shop beside it (world:things-are-tappable-models: a third act goes
// on a sheet), does it now with its card's button, the card says the time in words, and it never says it counts when the
// month ends or is ongoing; asked again, it is done again. The place file is the one the game ships; the scene is a
// stand-in that hands the city the taps a player makes, and the sheet lists the cards with the game's own picker, composed as
// the shell composes them.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame } from "../shared/testing/fixtures";
import { renderWithGame } from "../shared/testing/person";
import { hush, linesNow, resetLines } from "../shared/world/Lines";
import { nameOf, say } from "../shared/words/text";
import { ActivityPicker } from "../features/activity/ActivityView";
import { City } from "../features/city/City";
import { anchorFan } from "../features/city/fan/anchor";
import { pressFanAct } from "../features/city/fan/fan.testing";
import { stubWebGL, unstubWebGL } from "../shared/testing/webgl";
import { found } from "../shared/testing/render";


// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (world:fan-of-sticker-buttons).
vi.mock("../features/city/scene/CityScene", async () => ({ default: (await import("../features/city/fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../shared/three/manifest", async (original) => (await import("../shared/testing/manifest")).fromDisk(original));

beforeEach(() => {
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  stubWebGL();
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  unstubWebGL();
});

const FAMILY = "activity.family-time";
const COOK = "activity.cook-at-home";

describe("an act that repeats, at its thing", () => {
  test("[activity:acts-may-repeat-in-month] [activity:now-acts-spend-half-days] [world:things-are-tappable-models] given time with Mama, when her sheet opens twice, then each time her row picked, the one button does it now, the row names no time taken, it never counts at the month's end nor says Ongoing, each press is sent at once, and her words land over her head", async () => {
    resetLines();
    const game = newGame("scenario.graduate");
    const { authority, store } = await renderWithGame(<City world results={() => <p />} actions={(ids) => <ActivityPicker only={ids} />} />, game);
    await waitFor(() => found('[data-stand-in-thing="mama"]'), { timeout: 3000 });
    for (let time = 1; time <= 2; time += 1) {
      // Her fan's button for her time opens her sheet once the walk has reached her (world:fan-of-sticker-buttons).
      await pressFanAct("mama", FAMILY);
      const picker = await waitFor(() => found("[data-activity-picker]"));
      // Her sheet holds her shop beside the gist, as rows with one button in the foot (world:one-action-one-sheet).
      expect(picker.querySelector('[data-act-row="activity.help-shop"]')).not.toBeNull();
      const row = picker.querySelector<HTMLButtonElement>(`[data-act-row="${FAMILY}"]`);
      if (row === null) throw new Error("No row for time with Mama.");
      fireEvent.click(row);
      const card = row.closest("li");
      const main = picker.querySelector<HTMLButtonElement>(`button[data-act-main="${FAMILY}"]`);
      if (card === null || main === null) throw new Error("No card for time with Mama.");
      // Gist takes no time (halfDays 0), so the row names none.
      expect(card.querySelector('[data-fact="time"]')).toBeNull();
      expect(main.hasAttribute("disabled")).toBe(false);
      expect(picker.textContent).not.toContain(say("ui.world.counts-at-end"));
      expect(picker.textContent).not.toContain(say("ui.activity.planned"));
      expect(picker.textContent).not.toContain(say("ui.activity.uses-free"));
      act(() => hush());
      fireEvent.click(main);
      await waitFor(() => expect(authority.sent.filter((command) => command.type === "activity/now" && command.activity === FAMILY)).toHaveLength(time));
      // Her words land over her head (world:things-are-tappable-models), not on a card, and the sheet goes.
      await waitFor(() => expect(linesNow().speech).toMatchObject({ who: "mama", text: "You have eaten? Sit small." }));
      await waitFor(() => expect(document.querySelector("[data-activity-picker]")).toBeNull());
    }
    expect(store.getState().plan.some((pick) => pick !== null)).toBe(false);
  });
});

describe("an act the scene shows, from its sheet", () => {
  test("[world:things-are-tappable-models] [activity:acts-may-repeat-in-month] given the family house's cooking corner's sheet with the pot and the big pot, when food from the pot is had from its card, then it is sent at once, no card answers it, the sheet closes so the pot is seen, and the scene is handed the act to show where it was done", async () => {
    const game = newGame("scenario.graduate");
    const { authority } = await renderWithGame(<City world results={() => <p />} actions={(ids) => <ActivityPicker only={ids} />} />, game);
    // The corner's meals are the simulation's own fan buttons; with no room beside the corner they open as their sheet
    // (world:fan-of-sticker-buttons), which is the sheet this test reads.
    act(() => anchorFan("cooking", null));
    fireEvent.click(await waitFor(() => found('[data-stand-in-thing="cooking"]'), { timeout: 3000 }));
    const picker = await waitFor(() => found("[data-activity-picker]"));
    const cook = picker.querySelector<HTMLButtonElement>(`button[data-act-main="${COOK}"]`);
    if (cook === null) throw new Error("No card for the pot.");
    expect(nameOf(COOK)).toBe("Food from the pot");
    fireEvent.click(cook);
    await waitFor(() => expect(authority.sent.filter((command) => command.type === "activity/now" && command.activity === COOK)).toHaveLength(1));
    await waitFor(() => expect(document.querySelector("[data-activity-picker]")).toBeNull());
    expect(document.querySelector("[data-ask-form]")).toBeNull();
    expect(found("[data-stand-in-scene]").dataset.standInActed).toBe(COOK);
  });
});
