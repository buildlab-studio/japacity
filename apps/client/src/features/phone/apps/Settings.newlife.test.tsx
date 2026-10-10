// "Start a new life" in Settings (account.md R-ACCOUNT-030): one sheet names the character and their age and says
// plainly that the life ends and cannot be brought back; Cancel comes first, and the ending button ends the life only
// when held. A local end clears the save and the kept person, and the front door opens.
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App } from "../../../App";
import { GameProvider, useGame } from "../../../authority/GameProvider";
import { localAuthority, SAVE_KEY } from "../../../authority/local";
import { keepPerson, PERSON_KEY } from "../../../authority/person";
import { createGameStore, type GameStore } from "../../../authority/store";
import { engineView, fakeAuthority } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { clockWords } from "../../../shared/words/quality";
import { say } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { HOLD_MS } from "./Settings";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const NOON = () => new Date(2026, 9, 10, 12, 0);

/** A local life of Bisi's, kept in the browser's storage as the game keeps it. */
async function localLife(): Promise<{ store: GameStore; afresh: () => number }> {
  let seed = 0;
  const authority = localAuthority({ fastClock: true, makeSeed: () => `seed-${String((seed += 1))}`, now: () => 0 });
  let afresh = 0;
  const store = createGameStore(authority, { life: authority, afterLifeEnded: () => (afresh += 1) });
  keepPerson({ look: "chr_ada", name: "Bisi", archetype: null });
  await store.getState().chooseLife("scenario.ada");
  return { store, afresh: () => afresh };
}

/** The phone as the shell holds it: only while a life is playing, as WorldPlaying does. */
function WhilePlaying({ children }: { children: ReactNode }) {
  return useGame((state) => state.view) === null ? null : children;
}

function openSettings(store: GameStore): void {
  render(
    <GameProvider store={store}>
      <WhilePlaying>
        <PhoneApps onClose={() => undefined} area="Yaba" now={NOON} talk={null} />
      </WhilePlaying>
    </GameProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="settings"]')!);
}

function openSheet(): HTMLElement {
  fireEvent.click(document.querySelector<HTMLElement>("[data-life-end]")!);
  return screen.getByRole("dialog", { name: say("ui.life.end") });
}

function holdButton(): HTMLElement {
  return screen.getByRole("button", { name: say("ui.life.end.hold") });
}

/** Holds the ending button down for `ms`, then lets go when `release` says so. */
function hold(ms: number, release: boolean): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const button = holdButton();
  fireEvent.pointerDown(button);
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  if (release) fireEvent.pointerUp(button);
  vi.useRealTimers();
}

describe("start a new life", () => {
  test("[R-ACCOUNT-030] given a life, when Start a new life is opened, then one sheet names the character and their age, says the life ends and cannot be brought back, and offers Keep this life before the button held to end it", async () => {
    const { store } = await localLife();
    const view = store.getState().view as PlayerView;
    openSettings(store);

    const sheet = openSheet();

    expect(sheet.querySelector("[data-life-end-who]")?.textContent).toBe(say("ui.life.end.who", { name: "Bisi", age: clockWords(view.qualities) }));
    expect(sheet.textContent).toContain(say("ui.life.end.warn"));
    expect(sheet.textContent).toContain(say("ui.life.end.next"));
    expect(sheet.textContent).not.toContain(say("ui.life.end.linked"));
    const keep = screen.getByRole("button", { name: say("ui.life.end.keep") });
    expect(keep.compareDocumentPosition(holdButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet.querySelector("input")).toBeNull();

    fireEvent.click(keep);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: say("ui.life.end") })).toBeNull());
    expect(store.getState().view).not.toBeNull();
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });

  test("[R-ACCOUNT-030] given the sheet, when the ending button is let go before the hold is done or only clicked, then the life goes on", async () => {
    const { store } = await localLife();
    openSettings(store);
    openSheet();

    hold(HOLD_MS - 1, true);
    fireEvent.click(holdButton());

    expect(store.getState().view).not.toBeNull();
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    expect(localStorage.getItem(PERSON_KEY)).not.toBeNull();
  });

  test("[R-ACCOUNT-030] given a local life, when the ending button is held, then the save and the kept person are cleared and the front door opens", async () => {
    const { store, afresh } = await localLife();
    openSettings(store);
    openSheet();

    hold(HOLD_MS, false);

    await waitFor(() => expect(store.getState().view).toBeNull());
    expect(store.getState().choosingLife).toBe(true);
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
    expect(afresh()).toBe(1);

    render(<App store={store} />);
    expect(await screen.findByRole("heading", { name: say("ui.life.title") })).toBeDefined();
  });

  test("[R-ACCOUNT-030] given the sheet, when Enter is held on the ending button, then the life ends as by a finger", async () => {
    const { store } = await localLife();
    openSettings(store);
    openSheet();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    fireEvent.keyDown(holdButton(), { key: "Enter" });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();
    await waitFor(() => expect(store.getState().view).toBeNull());
  });

  test("[R-ACCOUNT-030] given a real partner joined to the life, then the sheet says they are told; given an authority that refuses, then the life stays and the sheet says it did not end", async () => {
    const base = engineView();
    const view: PlayerView = { ...base, people: { ...base.people, bonds: [...base.people.bonds, { ...(base.people.bonds[0] ?? ({} as PlayerView["people"]["bonds"][number])), id: "bond.real", role: "partner", stage: "partner", label: "player", person: null, pair: "pair-1" }] } };
    const authority = fakeAuthority(view);
    const store = createGameStore(authority, { life: { newLife: () => Promise.resolve(view), endLife: () => Promise.resolve(false) } });
    await store.getState().refresh();
    openSettings(store);
    const sheet = openSheet();
    expect(sheet.textContent).toContain(say("ui.life.end.linked"));

    hold(HOLD_MS, false);

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", say("ui.life.end.failed"));
    expect(store.getState().view).not.toBeNull();
  });

  test("[R-ACCOUNT-030] given an authority that cannot end a life, then Settings offers no new life", async () => {
    const authority = fakeAuthority(engineView());
    const store = createGameStore(authority);
    await store.getState().refresh();
    openSettings(store);
    expect(document.querySelector("[data-life-end]")).toBeNull();
  });
});
