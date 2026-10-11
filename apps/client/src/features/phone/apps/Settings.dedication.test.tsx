// The version line at the foot of Settings and the dedication its five taps show (docs/rules/city.md R-CITY-021,
// added 11 Oct 2026, item 1). The line says the build the page carries (R-SERVER-038), or
// "local" with none. Five taps within about five seconds show the owner's line just under it, simply; four do not, a
// sixth changes nothing, a tap elsewhere or leaving Settings hides it, and nothing of it is counted or sent.
import { DEDICATION, text } from "@japacity/content";
import { act, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider, useGame } from "../../../authority/GameProvider";
import { localAuthority } from "../../../authority/local";
import { keepPerson } from "../../../authority/person";
import { createGameStore, type GameStore } from "../../../authority/store";
import "../../../shared/testing/render";
import { STAMP_META } from "../../../shared/stamp/stamp";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";
import { DEDICATION_TAPS, DEDICATION_WINDOW_MS, versionOf } from "./Settings";

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

async function openSettings(): Promise<void> {
  const store = await localLife();
  render(
    <GameProvider store={store}>
      <WhilePlaying>
        <PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 11, 12, 0)} talk={null} />
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

function dedication(): string[] {
  return [...document.querySelectorAll("[data-dedication]")].map((line) => line.textContent ?? "");
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

  test("[R-CITY-021] given Settings open, when the version line is tapped four times, then nothing shows; the fifth shows the dedication simply under it; the sixth does nothing new, and nothing is counted or sent", async () => {
    await openSettings();
    const fetching = vi.spyOn(globalThis, "fetch");
    const dialogs = document.querySelectorAll("[role='dialog']").length;
    tap(DEDICATION_TAPS - 1);
    expect(dedication()).toEqual([]);
    tap(1);
    expect(dedication()).toEqual([OWNERS_LINE]);
    const line = document.querySelector("[data-dedication]");
    expect(line?.previousElementSibling).toBe(versionButton());
    expect(line?.querySelector("a, button")).toBeNull();
    tap(1);
    expect(dedication()).toEqual([OWNERS_LINE]);
    expect(document.querySelector("[data-dedication]")).toBe(line);
    expect(document.querySelectorAll("[role='dialog']")).toHaveLength(dialogs);
    expect(fetching).not.toHaveBeenCalled();
  });

  test("[R-CITY-021] given Settings open at its foot, when the fifth tap shows the dedication, then it is brought into view under the version line at once, so the home bar never cuts it", async () => {
    const seen: (ScrollIntoViewOptions | boolean | undefined)[] = [];
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element, options?: ScrollIntoViewOptions | boolean) {
      scrolled.push(this);
      seen.push(options);
    };
    await openSettings();
    for (let tap = 0; tap < DEDICATION_TAPS; tap += 1) fireEvent.click(versionButton());
    const line = document.querySelector("[data-dedication]");
    expect(line).not.toBeNull();
    expect(scrolled).toEqual([line]);
    expect(seen).toEqual([{ block: "nearest" }]);
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  test("[R-CITY-021] given five taps spread wider than the window, when the fifth lands, then nothing shows; five within it, then the dedication shows", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 11, 15, 0));
    await openSettings();
    const gap = Math.ceil(DEDICATION_WINDOW_MS / (DEDICATION_TAPS - 1)) + 1;
    for (let at = 0; at < DEDICATION_TAPS; at += 1) {
      tap(1);
      vi.advanceTimersByTime(gap);
    }
    expect(dedication()).toEqual([]);
    vi.advanceTimersByTime(DEDICATION_WINDOW_MS);
    for (let at = 0; at < DEDICATION_TAPS; at += 1) {
      tap(1);
      vi.advanceTimersByTime(Math.floor((DEDICATION_WINDOW_MS - 1) / DEDICATION_TAPS));
    }
    expect(dedication()).toEqual([OWNERS_LINE]);
  });

  test("[R-CITY-021] given the dedication shown, when the player taps elsewhere, then it hides and the count starts again; shown again and Settings left, then it is gone on return", async () => {
    await openSettings();
    tap(DEDICATION_TAPS);
    expect(dedication()).toHaveLength(1);
    fireEvent.pointerDown(versionButton());
    expect(dedication()).toHaveLength(1);
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(dedication()).toEqual([]);
    tap(DEDICATION_TAPS - 1);
    expect(dedication()).toEqual([]);
    tap(1);
    expect(dedication()).toHaveLength(1);

    fireEvent.click(document.querySelector<HTMLElement>("[data-phone-back]")!);
    openApp("settings");
    expect(dedication()).toEqual([]);
  });
});
