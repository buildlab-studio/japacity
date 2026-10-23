// world:back-closes-topmost: the browser's Back and the Escape key close the topmost thing opened, one at a time; each opening
// adds one history entry at the same address, and a close by the game's own control takes it off again.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { BackContext, type BackStack, createBack, LEVEL, replaceAddress, useBackLayer, useSceneCovered } from "./back";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

let stack: BackStack;

beforeEach(() => {
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => {
  stack.dispose();
});

/** Where the history stands: how many entries the game has added above the page's own. */
function depth(): number {
  const state = history.state as Record<string, unknown> | null;
  const value = state?.japacityBack;
  return typeof value === "number" ? value : 0;
}

/** One thing that opens and closes: its own button opens it, its close button closes it. */
function Thing({ name, level = LEVEL.sheet, hold = false, cover = false, start = false }: { name: string; level?: number; hold?: boolean; cover?: boolean; start?: boolean }) {
  const [open, setOpen] = useState(start);
  useBackLayer(open, () => setOpen(false), { level, hold, cover });
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open {name}
      </button>
      {open ? (
        <button type="button" onClick={() => setOpen(false)} data-open={name}>
          close {name}
        </button>
      ) : null}
    </div>
  );
}

/** The phone and an app inside it: the app is a layer of its own over the phone's. */
function Phone() {
  const [phone, setPhone] = useState(false);
  const [app, setApp] = useState<string | null>(null);
  useBackLayer(phone, () => setPhone(false), { level: LEVEL.phone, cover: true });
  useBackLayer(phone && app !== null, () => setApp(null), { level: LEVEL.app });
  return (
    <div>
      <button type="button" onClick={() => setPhone(true)}>
        open phone
      </button>
      {phone ? (
        <div data-open="phone">
          <button type="button" onClick={() => setApp("bank")}>
            open bank
          </button>
          <button
            type="button"
            onClick={() => {
              setPhone(false);
              setApp(null);
            }}
          >
            home bar
          </button>
          {app === null ? null : <p data-open="app">{app}</p>}
        </div>
      ) : null}
    </div>
  );
}

function Covered() {
  return <p data-covered={String(useSceneCovered())} />;
}

function within(children: React.ReactNode) {
  return render(<BackContext value={stack}>{children}</BackContext>);
}

const shown = (name: string) => document.querySelector(`[data-open="${name}"]`) !== null;

describe("Back and Escape", () => {
  test("[world:back-closes-topmost] given nothing open, when a sheet opens, then one history entry is added at the same address", async () => {
    within(<Thing name="sheet" />);
    const before = history.length;
    fireEvent.click(screen.getByText("open sheet"));
    await waitFor(() => expect(depth()).toBe(1));
    expect(history.length).toBe(before + 1);
    expect(location.pathname).toBe("/");
  });

  test("[world:back-closes-topmost] given two things open, when Back is pressed, then only the topmost closes, and the next Back closes the other", async () => {
    within(
      <>
        <Thing name="map" level={LEVEL.map} />
        <Thing name="sheet" />
      </>,
    );
    fireEvent.click(screen.getByText("open map"));
    fireEvent.click(screen.getByText("open sheet"));
    await waitFor(() => expect(depth()).toBe(2));
    act(() => history.back());
    await waitFor(() => expect(shown("sheet")).toBe(false));
    expect(shown("map")).toBe(true);
    act(() => history.back());
    await waitFor(() => expect(shown("map")).toBe(false));
    expect(depth()).toBe(0);
  });

  test("[world:back-closes-topmost] given two things open, when Escape is pressed, then the topmost closes and its entry is taken off; a second Escape closes the other", async () => {
    within(
      <>
        <Thing name="map" level={LEVEL.map} />
        <Thing name="sheet" />
      </>,
    );
    fireEvent.click(screen.getByText("open map"));
    fireEvent.click(screen.getByText("open sheet"));
    await waitFor(() => expect(depth()).toBe(2));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(depth()).toBe(1));
    expect(shown("sheet")).toBe(false);
    expect(shown("map")).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(depth()).toBe(0));
    expect(shown("map")).toBe(false);
  });

  test("[world:back-closes-topmost] given a dialog that heard Escape itself, when Escape reaches the page, then nothing more closes", async () => {
    within(<Thing name="map" level={LEVEL.map} />);
    fireEvent.click(screen.getByText("open map"));
    await waitFor(() => expect(depth()).toBe(1));
    const heard = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", heard);
    fireEvent.keyDown(document.body, { key: "Escape" });
    document.removeEventListener("keydown", heard);
    expect(shown("map")).toBe(true);
  });

  test("[world:back-closes-topmost] given a sheet closed by its own button, then its entry is taken off, so the next Back closes what is under it and never steps through the closed sheet", async () => {
    within(
      <>
        <Thing name="map" level={LEVEL.map} />
        <Thing name="sheet" />
      </>,
    );
    fireEvent.click(screen.getByText("open map"));
    fireEvent.click(screen.getByText("open sheet"));
    await waitFor(() => expect(depth()).toBe(2));
    fireEvent.click(screen.getByText("close sheet"));
    await waitFor(() => expect(depth()).toBe(1));
    act(() => history.back());
    await waitFor(() => expect(shown("map")).toBe(false));
    expect(depth()).toBe(0);
  });

  test("[world:back-closes-topmost] given the phone and an app in it, when Back is pressed twice, then the app closes first and then the phone; the home bar with an app open takes both entries off", async () => {
    within(<Phone />);
    fireEvent.click(screen.getByText("open phone"));
    fireEvent.click(screen.getByText("open bank"));
    await waitFor(() => expect(depth()).toBe(2));
    act(() => history.back());
    await waitFor(() => expect(shown("app")).toBe(false));
    expect(shown("phone")).toBe(true);
    act(() => history.back());
    await waitFor(() => expect(shown("phone")).toBe(false));

    fireEvent.click(screen.getByText("open phone"));
    fireEvent.click(screen.getByText("open bank"));
    await waitFor(() => expect(depth()).toBe(2));
    fireEvent.click(screen.getByText("home bar"));
    await waitFor(() => expect(depth()).toBe(0));
  });

  test("[world:back-closes-topmost] given a thing opened inside another and both mounted at once, then Back closes the inner one first", async () => {
    // The ride's sheet mounts with the map when the map opens on a stop already picked: the sheet's effect runs before the map's.
    function MapWithSheet() {
      const [map, setMap] = useState(true);
      return map ? (
        <div data-open="map">
          <Inner />
          <MapLayer close={() => setMap(false)} />
        </div>
      ) : null;
    }
    function MapLayer({ close }: { close: () => void }) {
      useBackLayer(true, close, { level: LEVEL.map });
      return null;
    }
    function Inner() {
      const [open, setOpen] = useState(true);
      useBackLayer(open, () => setOpen(false), { level: LEVEL.ride });
      return open ? <p data-open="ride" /> : null;
    }
    within(<MapWithSheet />);
    await waitFor(() => expect(depth()).toBe(2));
    act(() => history.back());
    await waitFor(() => expect(shown("ride")).toBe(false));
    expect(shown("map")).toBe(true);
  });

  test("[world:back-closes-topmost] given a beat that holds (a ride under way), when Back is pressed, then nothing closes and the entry stands again", async () => {
    within(
      <>
        <Thing name="map" level={LEVEL.map} />
        <Thing name="ride" hold />
      </>,
    );
    fireEvent.click(screen.getByText("open map"));
    fireEvent.click(screen.getByText("open ride"));
    await waitFor(() => expect(depth()).toBe(2));
    act(() => history.back());
    await waitFor(() => expect(depth()).toBe(2));
    expect(shown("ride")).toBe(true);
    expect(shown("map")).toBe(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(shown("ride")).toBe(true);
  });

  test("[world:back-closes-topmost] given the address replaced while a sheet is open, when Back closes it, then the address bar keeps the replaced address", async () => {
    history.replaceState(null, "", "/somewhere?from=link");
    within(<Thing name="sheet" />);
    fireEvent.click(screen.getByText("open sheet"));
    await waitFor(() => expect(depth()).toBe(1));
    replaceAddress("/?from=link");
    expect(depth()).toBe(1);
    act(() => history.back());
    await waitFor(() => expect(shown("sheet")).toBe(false));
    await waitFor(() => expect(`${location.pathname}${location.search}`).toBe("/?from=link"));
  });

  test("[world:reach-and-read] given a sheet that covers the scene, while it is open, then the scene is inert, and not once it closes", async () => {
    within(
      <>
        <Covered />
        <Thing name="sheet" cover />
      </>,
    );
    expect(document.querySelector("[data-covered]")?.getAttribute("data-covered")).toBe("false");
    fireEvent.click(screen.getByText("open sheet"));
    await waitFor(() => expect(document.querySelector("[data-covered]")?.getAttribute("data-covered")).toBe("true"));
    fireEvent.click(screen.getByText("close sheet"));
    await waitFor(() => expect(document.querySelector("[data-covered]")?.getAttribute("data-covered")).toBe("false"));
  });
});
