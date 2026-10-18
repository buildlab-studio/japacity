// Turning the house in the city (docs/rules/world.md R-WORLD-009, R-WORLD-029): in a wide home a
// round button over Phone turns the house a quarter round each tap, the scene asked for the quarter and a finger's turn
// coming to rest heard back; the quarter is kept beside the save, so the home opens as it was left; the button steps back
// while a fan, the phone or the map is open, and stands nowhere but a wide home. The place files are the ones the game
// ships; the scene is a stand-in that shows the quarter it was asked for and can come to rest on one, as a finger would.
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/person";
import { say } from "../../shared/words/text";
import { turnIn } from "../../shared/world/arranged";
import type { Thing } from "../../shared/world/contract";
import { markTaught } from "../../shared/world/taught";
import { City } from "./City";
import { anchorFan } from "./fan/anchor";
import { stubWebGL, unstubWebGL } from "../../shared/testing/webgl";

interface StandInProps {
  things?: Thing[];
  onPick: (pick: { kind: "thing"; thing: Thing }) => void;
  turn?: number;
  onTurned?: (quarter: number) => void;
}

function StandInScene({ things, onPick, turn, onTurned }: StandInProps) {
  return (
    <div data-stand-in-scene data-stand-in-turn={turn === undefined ? "none" : String(turn)}>
      {(things ?? []).map((thing) => (
        <button key={thing.id} type="button" data-stand-in-thing={thing.id} onClick={() => onPick({ kind: "thing", thing })} />
      ))}
      {/* A finger's turn released on the quarter before the one shown, as the scene reports it. */}
      <button type="button" data-stand-in-drag onClick={() => onTurned?.((((turn ?? 0) + 3) % 4))} />
    </div>
  );
}

vi.mock("./scene/CityScene", () => ({ default: StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => (await import("../../shared/testing/manifest")).fromDisk(original));

const SCREEN = { width: window.innerWidth, height: window.innerHeight };

beforeEach(() => {
  stubWebGL();
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  unstubWebGL();
  Object.defineProperty(window, "innerWidth", { value: SCREEN.width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: SCREEN.height, configurable: true });
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

/** Ada at a place, the first brief and the home's card already seen, so nothing stands over the world. */
async function at(place: string) {
  window.localStorage.setItem("japacity.city.last", JSON.stringify([place]));
  const game = newGame("scenario.ada");
  markTaught("title", game.view().scenario);
  markTaught(`home:${place}`, game.view().scenario);
  const rendered = await renderWithGame(<City world results={(here) => <p data-results-for={here} />} />, game);
  await waitFor(() => found("[data-stand-in-scene]"), { timeout: 3000 });
  return { game, ...rendered };
}

const turnShown = (): string | undefined => found("[data-stand-in-scene]").dataset.standInTurn;
const turnButton = (): HTMLElement => found("[data-turn-house]");
const stepsBack = (): boolean => turnButton().getAttribute("aria-hidden") === "true";

describe("turning the house", () => {
  test("[R-WORLD-009] [R-WORLD-029] given Ada at the family house, when the round button is tapped, then the scene is asked for the next quarter each tap, round the circle and back, and each is kept beside the save", async () => {
    const { game } = await at("place.family-house");
    await waitFor(() => turnButton(), { timeout: 3000 });
    expect(turnButton().getAttribute("aria-label")).toBe(say("ui.world.other-side"));
    expect(stepsBack()).toBe(false);
    expect(turnShown()).toBe("0");
    for (const quarter of [1, 2, 3, 0]) {
      fireEvent.click(turnButton());
      await waitFor(() => expect(turnShown()).toBe(String(quarter)));
      expect(turnIn("place.family-house", game.view().scenario)).toBe(quarter);
    }
  });

  test("[R-WORLD-009] [R-WORLD-029] given a finger's turn coming to rest on a quarter, when the scene says so, then that quarter is kept, and the house opens on it the next time the life is opened", async () => {
    const { game } = await at("place.family-house");
    fireEvent.click(found("[data-stand-in-drag]"));
    await waitFor(() => expect(turnShown()).toBe("3"));
    expect(turnIn("place.family-house", game.view().scenario)).toBe(3);
    cleanup();
    // The life opened anew: the kept quarter, read beside the save.
    await renderWithGame(<City world results={(here) => <p data-results-for={here} />} />, game);
    await waitFor(() => expect(turnShown()).toBe("3"), { timeout: 3000 });
  });

  test("[R-WORLD-009] given the round button, when a thing's fan or the phone is open over the house, then it steps back, and it is back once the fan closes", async () => {
    await at("place.family-house");
    await waitFor(() => turnButton(), { timeout: 3000 });
    // A thing's fan.
    fireEvent.click(await waitFor(() => found('[data-stand-in-thing="cooking"]'), { timeout: 3000 }));
    act(() => anchorFan("cooking", { x: 90, y: 560 }));
    await waitFor(() => found('[data-fan="cooking"]'));
    expect(stepsBack()).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.querySelector('[data-fan="cooking"]')).toBeNull());
    expect(stepsBack()).toBe(false);
    // The phone.
    fireEvent.click(found("[data-thumb='phone']"));
    await waitFor(() => expect(stepsBack()).toBe(true));
  });

  test("[R-WORLD-009] given a place that is not a wide home, when the world shows it, then there is no round button and the scene is asked for no quarter, its own turn limit standing", async () => {
    await at("place.yaba");
    await waitFor(() => found("[data-thumb='phone']"), { timeout: 3000 });
    expect(document.querySelector("[data-turn-house]")).toBeNull();
    expect(turnShown()).toBe("none");
  });
});
