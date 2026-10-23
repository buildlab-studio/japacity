// world:back-closes-topmost at the door: each step of the door is an entry, so Back walks the door's screens back one at a
// time, as the door's own back arrow does.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { type BackStack, createBack } from "../../shared/back/back";
import { toTheArchetypes } from "../../shared/front-door/frontDoor.testing";
import { say } from "../../shared/words/text";
import { FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

let stack: BackStack;

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => {
  cleanup();
  stack.dispose();
});

const step = () => document.querySelector("[data-door-frame]")?.getAttribute("data-gate") ?? null;
const depth = () => (history.state as Record<string, unknown> | null)?.japacityBack ?? 0;

function door() {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "door-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <FrontDoor />
    </GameProvider>,
  );
}

test("[world:back-closes-topmost] given the door's third screen reached step by step, when Back is pressed twice, then the door goes back a screen each time, to its first", async () => {
  door();
  await toTheArchetypes();
  expect(step()).toBe("life");
  await waitFor(() => expect(depth()).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
  await waitFor(() => expect(step()).toBe("page"));
  await waitFor(() => expect(depth()).toBe(2));
  act(() => history.back());
  await waitFor(() => expect(step()).toBe("life"));
  act(() => history.back());
  await waitFor(() => expect(step()).toBe("you"));
  expect(depth()).toBe(0);
});

test("[world:back-closes-topmost] given the door's second screen, when its own back arrow is tapped, then the entry is taken off with it", async () => {
  door();
  await toTheArchetypes();
  await waitFor(() => expect(depth()).toBe(1));
  fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
  await waitFor(() => expect(step()).toBe("you"));
  await waitFor(() => expect(depth()).toBe(0));
});
