// Sleep is a timed act from the bed (docs/rules/world.md R-WORLD-025, R-WORLD-005; decision 0011): sleep
// takes a fixed time and the player can wake out of it. The bed's Sleep lays the figure down under a soft dark wash, with
// a chip under the band and a Wake up button; the month turns only when the sleep runs out, and waking first makes it a
// nap. The place file is the one the game ships; the scene is a stand-in that hands the city the taps a player makes.
import { type DayPart, type WorldClock, worldClockAt } from "@japacity/sim";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { GameStore } from "../../authority/store";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/person";
import { say } from "../../shared/words/text";
import { CUT_MS } from "../../shared/world/Cut";
import { markTaught } from "../../shared/world/taught";
import { City, RESULTS_BEAT_MS } from "./City";
import { NAP, SLEEP_MS } from "./acts/sleep";
import { pressFanActNow } from "./fan/fan.testing";
import { stubWebGL, unstubWebGL } from "../../shared/testing/webgl";


// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (R-WORLD-034).
vi.mock("./scene/CityScene", async () => ({ default: (await import("./fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => (await import("../../shared/testing/manifest")).fromDisk(original));

beforeEach(() => {
  stubWebGL();
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  unstubWebGL();
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

/** The world's clock at a part of its day, as a reply carries it. */
function clockAt(part: DayPart): { tick: number; nextTickAt: number; nextTurnAt: null; morningAt: number; world: WorldClock } {
  const world = worldClockAt(Date.now());
  return { tick: 0, nextTickAt: 0, nextTurnAt: null, morningAt: world.morningAt, world: { ...world, part } };
}

function setPart(store: GameStore, part: DayPart): void {
  act(() => store.setState({ clock: clockAt(part) }));
}

/** Ada in the parlour by the bed with a month behind her (so no first night's card), the clocks faked from here on. */
async function byTheBed(part: DayPart = "afternoon") {
  const game = newGame("scenario.ada");
  game.endTurn();
  // The home's one small card was read in an earlier sitting, so the corner is not under it.
  markTaught("home:place.family-house", "scenario.ada");
  const rendered = await renderWithGame(<City world results={(place) => <p data-results-for={place} />} phone={(close) => <button type="button" data-stand-in-phone onClick={close} />} />, game);
  await waitFor(() => found('[data-stand-in-thing="mattress"]'), { timeout: 3000 });
  setPart(rendered.store, part);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  return { game, ...rendered };
}

/** Time passes on the faked clocks, and what it set going lands. */
async function pass(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const sent = (authority: { sent: readonly { type: string }[] }, type: string) => authority.sent.filter((command) => command.type === type);
const washOn = (): boolean => found("[data-sleep-wash]").dataset.sleepWash === "on";

describe("sleep, a timed act from the bed", () => {
  test("[R-WORLD-025] [R-WORLD-005] given the bed's Sleep tapped, when the sleep runs, then the figure lies on the bed under the wash with the chip and Wake up, the nudge hidden and Map and Phone kept, and nothing is sent until the time runs out; then turn/end goes once and the results open", async () => {
    const { authority } = await byTheBed();
    expect(document.querySelector("[data-nudge]")).not.toBeNull();
    expect(washOn()).toBe(false);
    pressFanActNow("mattress", "end-month");
    await pass(0);
    const chip = found("[data-asleep]");
    expect(chip.textContent).toContain("Asleep · tap to wake");
    expect(chip.querySelector("[data-asleep-bar]")).not.toBeNull();
    expect(found("[data-wake]").textContent).toBe(say("ui.sleep.wake"));
    expect(washOn()).toBe(true);
    expect(found("[data-stand-in-scene]").dataset.standInAsleep).toBe("mattress");
    expect(document.querySelector("[data-nudge]")).toBeNull();
    expect(document.querySelector('[data-thumb="map"]')).not.toBeNull();
    expect(document.querySelector('[data-thumb="phone"]')).not.toBeNull();
    // The bed never opens the phone's lock screen before the turn.
    expect(document.querySelector("[data-stand-in-phone]")).toBeNull();
    await pass(SLEEP_MS - 1);
    expect(sent(authority, "turn/end")).toHaveLength(0);
    expect(document.querySelector("[data-asleep]")).not.toBeNull();
    await pass(1);
    expect(sent(authority, "turn/end")).toHaveLength(1);
    expect(sent(authority, "activity/now")).toHaveLength(0);
    expect(document.querySelector("[data-asleep]")).toBeNull();
    expect(document.querySelector("[data-wake]")).toBeNull();
    await pass(RESULTS_BEAT_MS + CUT_MS * 2 + 100);
    expect(found("[data-results-for]").dataset.resultsFor).toBeTruthy();
    expect(washOn()).toBe(false);
    expect(found("[data-stand-in-scene]").dataset.standInAsleep).toBe("");
    expect(sent(authority, "turn/end")).toHaveLength(1);
  });

  test("[R-WORLD-025] given a sleep under way, when the chip is tapped before it runs out, then the nap is sent and no turn/end, the chip, Wake up and the wash go, the figure gets up, and the corner says Up again by day", async () => {
    const { authority, game } = await byTheBed("afternoon");
    expect(game.view().activities.find((option) => option.id === NAP)?.allowed).toBe(true);
    pressFanActNow("mattress", "end-month");
    await pass(SLEEP_MS / 2);
    fireEvent.click(found("[data-asleep]"));
    await pass(0);
    expect(sent(authority, "activity/now")).toHaveLength(1);
    expect(sent(authority, "activity/now")[0]).toMatchObject({ type: "activity/now", activity: NAP, param: null });
    expect(document.querySelector("[data-asleep]")).toBeNull();
    expect(document.querySelector("[data-wake]")).toBeNull();
    expect(washOn()).toBe(false);
    expect(found("[data-stand-in-scene]").dataset.standInAsleep).toBe("");
    expect(found("[data-corner]").textContent).toContain("Up again.");
    expect(found("[data-corner]").textContent).not.toContain("The night is still yours.");
    // The nap's own line is not told over the waking.
    expect(found("[data-corner]").textContent).not.toContain(say("line.activity.nap.now"));
    await pass(SLEEP_MS);
    expect(sent(authority, "turn/end")).toHaveLength(0);
  });

  test("[R-WORLD-025] given a sleep at the world's night, when Wake up is tapped, then it does as the chip does, and the corner says the night is still yours", async () => {
    const { authority } = await byTheBed("night");
    pressFanActNow("mattress", "end-month");
    await pass(1000);
    fireEvent.click(found("[data-wake]"));
    await pass(0);
    expect(sent(authority, "activity/now").map((command) => (command as { activity?: string }).activity)).toEqual([NAP]);
    expect(document.querySelector("[data-asleep]")).toBeNull();
    expect(washOn()).toBe(false);
    expect(found("[data-corner]").textContent).toContain("Up again. The night is still yours.");
    await pass(SLEEP_MS);
    expect(sent(authority, "turn/end")).toHaveLength(0);
  });

  test("[R-WORLD-025] given a sleep under way, when the phone is opened from its button and the sleep runs out under it, then the month waits for the phone to be put away, then turns once", async () => {
    const { authority } = await byTheBed();
    pressFanActNow("mattress", "end-month");
    await pass(0);
    fireEvent.click(found('[data-thumb="phone"]'));
    expect(document.querySelector("[data-stand-in-phone]")).not.toBeNull();
    await pass(SLEEP_MS + 10);
    expect(sent(authority, "turn/end")).toHaveLength(0);
    fireEvent.click(found("[data-stand-in-phone]"));
    await pass(0);
    expect(sent(authority, "turn/end")).toHaveLength(1);
  });

  test("[R-WORLD-025] given a sleep under way, when the world's night falls, then the nudge stays hidden until the sleep is over, and comes back on waking", async () => {
    const { store } = await byTheBed();
    pressFanActNow("mattress", "end-month");
    await pass(0);
    setPart(store, "night");
    expect(document.querySelector("[data-nudge]")).toBeNull();
    fireEvent.click(found("[data-asleep]"));
    await pass(0);
    expect(document.querySelector("[data-nudge]")).not.toBeNull();
  });
});
