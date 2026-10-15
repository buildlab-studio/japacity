// The version line at the foot of Settings and the dedication page its five taps open (docs/rules/city.md R-CITY-021,
// added 11 Oct 2026, the decision of 14:47, item 1; amended 15 Oct 2026: the taps open the page of account.md
// R-ACCOUNT-032 instead of showing the line under the row). The line says the build the page carries (R-SERVER-038), or
// "local" with none. Five taps within about five seconds open the page; four do not, a sixth changes nothing, a tap
// elsewhere or closing the page starts the count again, leaving Settings closes it, and nothing of it is counted or
// sent. The shell hands the page in (the phone imports no other feature), so here a stand-in with the owner's line is
// handed the same way; the page itself is proven in features/account/Dedication.test.tsx.
import { DEDICATION, text } from "@japacity/content";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider, useGame } from "../../../authority/GameProvider";
import { localAuthority } from "../../../authority/local";
import { keepPerson } from "../../../authority/person";
import { createGameStore, type GameStore } from "../../../authority/store";
import "../../../shared/testing/render";
import { STAMP_META } from "../../../shared/stamp/stamp";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";
import { type DedicationScreen, DEDICATION_TAPS, DEDICATION_WINDOW_MS, versionOf } from "./Settings";

const OWNERS_LINE = "Dedicated to my best friend, Osoko Emmanuel (July 1998 to June 2026). From Al-Ameen.";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  document.head.querySelectorAll(`meta[name="${STAMP_META}"]`).forEach((meta) => meta.remove());
});

async function localLife(): Promise<GameStore> {
  const authority = localAuthority({ fastClock: true, makeSeed: () => "seed-1", now: () => 0 });
  const store = createGameStore(authority, { life: authority, afterLifeEnded: () => undefined });
  keepPerson({ look: "chr_ada", name: "Bisi", archetype: null });
  await store.getState().chooseLife("scenario.ada");
  return store;
}

function WhilePlaying({ children }: { children: ReactNode }) {
  return useGame((state) => state.view) === null ? null : children;
}

function openApp(id: string): void {
  fireEvent.click(document.querySelector<HTMLElement>(`[data-app="${id}"]`)!);
}

/** Every time the shell's page was drawn open, and the way the version line closes it. */
let opened: { open: boolean; close: () => void }[] = [];

/** The page as the shell hands it in: a dialog over the page with the owner's line and a close, drawn only while open. */
const handedPage: DedicationScreen = (open, close) => {
  opened.push({ open, close });
  return open
    ? createPortal(
        <div role="dialog" aria-label="Dedication" data-handed-page>
          <p data-dedication>{DEDICATION}</p>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>,
        document.body,
      )
    : null;
};

async function openSettings(): Promise<void> {
  opened = [];
  const store = await localLife();
  render(
    <GameProvider store={store}>
      <WhilePlaying>
        <PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 11, 12, 0)} talk={null} dedication={handedPage} />
      </WhilePlaying>
    </GameProvider>,
  );
  openApp("settings");
}

function versionButton(): HTMLElement {
  const button = document.querySelector<HTMLElement>("[data-version] button");
  if (button === null) throw new Error("No version line.");
  return button;
}

function tap(times: number): void {
  for (let at = 0; at < times; at += 1) fireEvent.click(versionButton());
}

/** the owner's line on every page open now. */
function dedication(): string[] {
  return [...document.querySelectorAll("[data-handed-page] [data-dedication]")].map((line) => line.textContent ?? "");
}

/** How many times the page was opened: each time it was drawn open after being drawn closed. */
function openings(): number {
  return opened.filter((each, at) => each.open && opened[at - 1]?.open !== true).length;
}

describe("the version line and the dedication", () => {
  test("[R-CITY-021] given the dedication and the version line, when their words are looked up, then they are the owner's line and the line's words, kept in content", () => {
    expect(DEDICATION).toBe(OWNERS_LINE);
    expect(text["phone.settings.version"]).toBe("Version");
    expect(text["phone.settings.version.local"]).toBe("local");
  });

  test("[R-CITY-021] given a page stamped with its build, when Settings opens, then its last line says Version and the short commit; with no stamp, then it says local", async () => {
    expect(versionOf("e39f911b0a1c")).toBe("e39f911");
    expect(versionOf("e39f911b0a1c+changes")).toBe("e39f911");
    expect(versionOf("unknown")).toBeNull();
    expect(versionOf(null)).toBeNull();

    const meta = document.createElement("meta");
    meta.setAttribute("name", STAMP_META);
    meta.setAttribute("content", "a1b2c3d4e5f6");
    document.head.append(meta);
    await openSettings();
    const settings = document.querySelector("[data-phone-app='settings']");
    expect(settings?.lastElementChild?.hasAttribute("data-version")).toBe(true);
    expect(versionButton().textContent).toBe(`${phoneWords("phone.settings.version")}a1b2c3d`);
    expect(dedication()).toEqual([]);

    meta.remove();
    fireEvent.click(document.querySelector<HTMLElement>("[data-phone-back]")!);
    openApp("settings");
    expect(versionButton().textContent).toBe(`${phoneWords("phone.settings.version")}${phoneWords("phone.settings.version.local")}`);
    expect(phoneWords("phone.settings.version.local")).toBe("local");
  });

  test("[R-CITY-021] [R-ACCOUNT-032] given Settings open, when the version line is tapped four times, then nothing opens; the fifth opens the dedication page; the sixth does nothing new, and nothing is counted or sent", async () => {
    await openSettings();
    const fetching = vi.spyOn(globalThis, "fetch");
    tap(DEDICATION_TAPS - 1);
    expect(dedication()).toEqual([]);
    expect(openings()).toBe(0);
    tap(1);
    expect(dedication()).toEqual([OWNERS_LINE]);
    expect(screen.getAllByRole("dialog", { name: "Dedication" })).toHaveLength(1);
    expect(openings()).toBe(1);
    const page = document.querySelector("[data-handed-page]");
    tap(1);
    expect(dedication()).toEqual([OWNERS_LINE]);
    expect(document.querySelector("[data-handed-page]")).toBe(page);
    expect(openings()).toBe(1);
    expect(fetching).not.toHaveBeenCalled();
  });

  test("[R-CITY-021] [R-ACCOUNT-032] given the fifth tap, then the page opens in place of the line under the row: nothing more shows under the version line and no link or sheet comes with it", async () => {
    await openSettings();
    const row = document.querySelector("[data-version]")!;
    const before = row.innerHTML;
    const dialogs = document.querySelectorAll("[role='dialog']").length;
    tap(DEDICATION_TAPS);
    expect(openings()).toBe(1);
    // The handed page is drawn by the shell's own dialog; under the row itself nothing is added.
    expect(row.innerHTML).toBe(before);
    expect(row.querySelectorAll("p, a")).toHaveLength(0);
    // One dialog more, the page: no sheet comes with it.
    expect(document.querySelectorAll("[role='dialog']")).toHaveLength(dialogs + 1);
  });

  test("[R-CITY-021] [R-ACCOUNT-032] given five taps spread wider than the window, when the fifth lands, then nothing opens; five within it, then the dedication page opens", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 11, 15, 0));
    await openSettings();
    const gap = Math.ceil(DEDICATION_WINDOW_MS / (DEDICATION_TAPS - 1)) + 1;
    for (let at = 0; at < DEDICATION_TAPS; at += 1) {
      tap(1);
      vi.advanceTimersByTime(gap);
    }
    expect(dedication()).toEqual([]);
    expect(openings()).toBe(0);
    vi.advanceTimersByTime(DEDICATION_WINDOW_MS);
    for (let at = 0; at < DEDICATION_TAPS; at += 1) {
      tap(1);
      vi.advanceTimersByTime(Math.floor((DEDICATION_WINDOW_MS - 1) / DEDICATION_TAPS));
    }
    expect(dedication()).toEqual([OWNERS_LINE]);
    expect(openings()).toBe(1);
  });

  test("[R-CITY-021] [R-ACCOUNT-032] given four taps, when the player taps elsewhere, then the count starts again; given the page open, when it is closed, then the count starts again too", async () => {
    await openSettings();
    tap(DEDICATION_TAPS - 1);
    fireEvent.pointerDown(versionButton());
    tap(1);
    expect(openings()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dedication()).toEqual([]);
    tap(DEDICATION_TAPS - 1);
    expect(dedication()).toEqual([]);
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    tap(1);
    expect(dedication()).toEqual([]);
    tap(DEDICATION_TAPS - 1);
    expect(dedication()).toEqual([OWNERS_LINE]);
    expect(openings()).toBe(2);
  });

  test("[R-CITY-021] [R-ACCOUNT-032] given the page open, when Settings is left and opened again, then the page is closed on return", async () => {
    await openSettings();
    tap(DEDICATION_TAPS);
    expect(dedication()).toHaveLength(1);
    act(() => {
      opened.at(-1)?.close();
    });
    fireEvent.click(document.querySelector<HTMLElement>("[data-phone-back]")!);
    openApp("settings");
    expect(dedication()).toEqual([]);
    tap(DEDICATION_TAPS);
    expect(dedication()).toHaveLength(1);
    // Leaving Settings with the page still drawn open takes the page with it.
    fireEvent.click(document.querySelector<HTMLElement>("[data-phone-back]")!);
    expect(dedication()).toEqual([]);
    openApp("settings");
    expect(dedication()).toEqual([]);
  });
});
