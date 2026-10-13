// The front door where a life is started only once (prologue.md R-PROLOGUE-011): there the
// family's draw is made once, so the tiles say the years may go another way. Where a life may be started over, the
// authority keeps the tile's path open instead, and the tiles say nothing of it.
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { toTheArchetypes } from "../../shared/frontdoor/frontDoor.testing";
import { say } from "../../shared/words/text";
import { ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

function door(lifeAgain: boolean) {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "door-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
}

describe("the tiles' words on one life", () => {
  test("[R-PROLOGUE-011] given a life that is started only once, as online, when the tiles are shown, then they say the years may go another way", async () => {
    door(false);
    await toTheArchetypes();
    expect(document.querySelector("[data-door-once]")?.textContent).toBe(say("prologue.archetype.once"));
    expect(document.querySelector("[data-archetypes]")).not.toBeNull();
  });

  test("[R-PROLOGUE-011] given a life that may be started over, when the tiles are shown, then nothing says the years may go another way", async () => {
    door(true);
    await toTheArchetypes();
    expect(document.querySelector("[data-archetypes]")).not.toBeNull();
    expect(document.querySelector("[data-door-once]")).toBeNull();
  });
});

describe("the door's first screen", () => {
  test("[R-PROLOGUE-013] given the door's first screen, then the lockup heads it once, in the dark ground's file, and the screen's own question is still its heading", async () => {
    // A run kept from the tests above would open past the first screen.
    localStorage.clear();
    door(true);
    await waitFor(() => {
      if (document.querySelector("[data-gate='you']") === null) throw new Error("No first screen yet.");
    });
    const marks = screen.getAllByRole("img", { name: say("ui.game") });
    expect(marks).toHaveLength(1);
    expect(marks[0]?.getAttribute("src")).toMatch(/brand\/japacity-lockup-dark\.svg$/);
    expect(document.querySelector("[data-wordmark='dark']")).not.toBeNull();
    expect(screen.queryByText(say("ui.game"))).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(say("ui.life.title"));
  });
});
