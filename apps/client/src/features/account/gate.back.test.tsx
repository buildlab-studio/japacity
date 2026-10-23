// world:back-closes-topmost at the start: the age screen and the door are steps over the start screen, so Back from either
// returns to the start screen, and an age already answered is not asked again on the way back in.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { type BackStack, createBack } from "../../shared/back/back";
import type { AccountApi, AgeStanding } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { answerAge } from "./age.testing";
import { TEST_SITE_KEY } from "./Turnstile";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

let stack: BackStack;

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => stack.dispose());

const depth = () => (history.state as Record<string, unknown> | null)?.japacityBack ?? 0;
const shown = () => document.querySelector("[data-account-step]")?.getAttribute("data-account-step") ?? null;

/** An account whose age screen is answered by the server's rule: 18 or over passes. */
function account(): AccountApi {
  const declareAge = (birth: string): Promise<AgeStanding> => Promise.resolve(Number(birth.slice(0, 4)) <= new Date().getUTCFullYear() - 19 ? "passed" : "refused");
  const unused = () => Promise.reject(new Error("unused"));
  const api: AccountApi = {
    ageStatus: () => Promise.resolve("unasked"),
    declareAge,
    usernameFree: () => Promise.resolve(null),
    returnedFromGoogle: () => null,
    startGuest: unused,
    view: () => Promise.resolve(null),
    rename: unused,
    sendCode: unused,
    signInWithCode: unused,
    signInWithGoogle: unused,
    signInWithPasskey: unused,
    addPasskey: unused,
    email: () => Promise.resolve(null),
    deleteAccount: unused,
    signOut: unused,
    signOutEverywhere: unused,
    passkeysWork: () => Promise.resolve(false),
    passkeys: () => Promise.resolve([]),
    removePasskey: unused,
    confirmWithPasskey: unused,
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(false),
  };
  return api;
}

function gate() {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account: account() });
  store.getState().leave(null);
  render(
    <GameProvider store={store}>
      <AccountGate load={() => new Promise(() => undefined)} sitekey={TEST_SITE_KEY} />
    </GameProvider>,
  );
}

async function play() {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.play") }));
}

test("[world:back-closes-topmost] given the age screen after Play, when Back is pressed, then the start screen is back and the entry is gone", async () => {
  gate();
  await play();
  await waitFor(() => expect(shown()).toBe("age"));
  await waitFor(() => expect(depth()).toBe(1));
  act(() => history.back());
  await waitFor(() => expect(shown()).toBe("start"));
  expect(depth()).toBe(0);
});

test("[world:back-closes-topmost] given the age answered and the door's step on, when Back is pressed, then the start screen is back, and Play goes on without asking the age again", async () => {
  gate();
  await play();
  await answerAge(`${String(new Date().getUTCFullYear() - 30)}-01-01`);
  await waitFor(() => expect(shown()).toBe("door"));
  act(() => history.back());
  await waitFor(() => expect(shown()).toBe("start"));
  await play();
  await waitFor(() => expect(shown()).toBe("door"));
});
