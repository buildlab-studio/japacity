// The road in the world, only in the moment (docs/design/09-the-games-look.md section 4):
// nothing under the band by default; at the step's place the brief's chip with its dots and the marker
// on the thing to do; a thing done ticks its dot and the giver says so under the chip for three seconds; walking out takes
// the chip away; a chapter closed brings the brief back with its stamp and the next brief as a picture card.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { found, renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { resetLines, tell } from "../../shared/world/Lines";
import { markTaught } from "../../shared/world/taught";
import { DONE_TOAST_MS, doneToast } from "./brief/brief";
import { City } from "./City";
import { stubWebGL, unstubWebGL } from "../../shared/testing/webgl";

// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (world:fan-of-sticker-buttons).
vi.mock("./scene/CityScene", async () => ({ default: (await import("./fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => (await import("../../shared/testing/manifest")).fromDisk(original));

const SCREEN = { width: window.innerWidth, height: window.innerHeight };

beforeEach(() => {
  stubWebGL();
  
  // A phone held upright, as the game is built for.
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


const world = () => <City world results={(place) => <p data-results-for={place} />} />;

/** A fresh life whose first brief was handed in an earlier visit, standing at `place`. */
async function standing(place: string, view = engineView()) {
  markTaught("title", view.scenario);
  window.localStorage.setItem("japacity.city.last", JSON.stringify([place]));
  const rendered = await renderWithView(world(), view);
  await waitFor(() => found("[data-stand-in-scene] [data-stand-in-thing]"), { timeout: 3000 });
  return rendered;
}

describe("the first brief's card", () => {
  test("[chapter:first-chapter-mission-card] [world:nudge-says-one-thing] given a new life whose place is still drawing, when the world opens, then the brief's card waits for the place's first frame, then stands on the dimmed place with nothing under the band, and the chip comes only once Let's go has carried it", async () => {
    const view = engineView();
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
    await renderWithView(world(), view);
    await waitFor(() => found("[data-stand-in-scene] [data-stand-in-draw]"), { timeout: 3000 });
    // The card never stands over a blank world: the place draws behind it first.
    expect(document.querySelector("[data-opening]")).toBeNull();
    fireEvent.click(found("[data-stand-in-draw]"));
    await waitFor(() => found("[data-opening]"));
    expect(document.querySelector("[data-brief-scrim]")).not.toBeNull();
    // The card says the brief: no chip and no nudge under the band say it again.
    expect(document.querySelector("[data-band] [data-nudge]")).toBeNull();
    fireEvent.click(found("[data-opening-go]"));
    await waitFor(() => expect(document.querySelector("[data-opening]")).toBeNull());
    expect(document.querySelector("[data-brief-scrim]")).toBeNull();
    await waitFor(() => found("[data-band] [data-brief-chip]"));
  });
});

describe("the first brief's card's wait", () => {
  test("[chapter:first-chapter-mission-card] [account:guest-secures-the-life] given a new life whose place is still drawing, then the card's wait is marked in the document for the asks and the suite, and the mark goes once the card stands", async () => {
    const view = engineView();
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
    await renderWithView(world(), view);
    await waitFor(() => found("[data-stand-in-scene] [data-stand-in-draw]"));
    expect(document.querySelector("[data-opening]")).toBeNull();
    expect(document.querySelector("[data-brief-pending]")).not.toBeNull();
    fireEvent.click(found("[data-stand-in-draw]"));
    await waitFor(() => found("[data-opening]"));
    expect(document.querySelector("[data-brief-pending]")).toBeNull();
    fireEvent.click(found("[data-opening-go]"));
    await waitFor(() => expect(document.querySelector("[data-opening]")).toBeNull());
    expect(document.querySelector("[data-brief-pending]")).toBeNull();
  });
});

describe("the chip that shows the whole place", () => {
  test("[world:camera-always-raised] given the view close on the character, when a line stands in the corner or a thing's fan opens, then See the whole place steps back, so it never shares the foot with the corner's line nor stands under an open card, and comes back once the world is free", async () => {
    resetLines();
    await standing("place.family-house");
    // The home's small card is put away, so the world is free.
    const teach = document.querySelector<HTMLElement>("[data-home-teach-ok]");
    if (teach !== null) fireEvent.click(teach);
    fireEvent.click(found("[data-stand-in-zoom]"));
    await waitFor(() => found("[data-zoom-preset]"));
    act(() => tell("Mama presses a bag of oranges on you."));
    expect(document.querySelector("[data-corner]")).not.toBeNull();
    expect(document.querySelector("[data-zoom-preset]")).toBeNull();
    act(() => resetLines());
    await waitFor(() => found("[data-zoom-preset]"));
    fireEvent.click(found('[data-stand-in-thing="cooking"]'));
    await waitFor(() => found('[data-fan="cooking"]'));
    expect(document.querySelector("[data-zoom-preset]")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => found("[data-zoom-preset]"));
  });
});

describe("the road in the world, only in the moment", () => {
  test("[world:nudge-says-one-thing] given the first brief carried and the player at home, away from its place, when the world shows, then nothing stands under the band and no marker stands anywhere", async () => {
    await standing("place.family-house");
    expect(document.querySelector("[data-band] [data-nudge]")).toBeNull();
    expect(document.querySelector("[data-marker]")).toBeNull();
  });

  test("[world:nudge-says-one-thing] [world:things-are-tappable-models] given the player at the hub where the brief's first thing is done, when the world shows, then the chip names the brief with a dot for each thing, the marker stands on the board with the thing to do, and the chip's tap opens the board's fan", async () => {
    const view = engineView();
    await standing("place.yaba", view);
    const chip = await waitFor(() => found("[data-brief-chip='here']"));
    expect(chip.textContent).toContain(say("chapter.find-your-feet.brief.title"));
    expect([...chip.querySelectorAll<HTMLElement>("[data-dot]")].map((dot) => dot.dataset.dot)).toEqual(view.chapter.items.map((item, index) => (item.met ? "done" : index === view.chapter.items.findIndex((one) => !one.met) ? "now" : "later")));
    const marker = found("[data-marker]");
    expect(marker.dataset.marker).toBe("jobs");
    expect(marker.getAttribute("aria-label")).toBe(say("chapter.find-your-feet.item.job"));
    // The chip says which brief, the marker what to do: never the same words.
    expect(chip.textContent).not.toContain(say("chapter.find-your-feet.item.job"));
    expect(found("[data-marker-ring]").dataset.markerRing).toBe("jobs");
    fireEvent.click(found("[data-brief-chip] [data-nudge-open]"));
    // The board's fan opens over it (world:fan-of-sticker-buttons).
    expect(document.querySelector('[data-fan="jobs"]')).not.toBeNull();
  });

  test("[world:nudge-says-one-thing] [world:things-are-tappable-models] given the marker on the step's thing, when its pill is tapped, then the thing is picked as the chip's tap picks it, whoever stands in front of the thing", async () => {
    await standing("place.yaba", engineView());
    await waitFor(() => found("[data-marker-tap]"));
    fireEvent.click(found("[data-marker-tap='jobs']"));
    expect(document.querySelector('[data-fan="jobs"]')).not.toBeNull();
  });

  test("[world:nudge-says-one-thing] given the chip at the step's place, when a thing comes in, then its dot ticks, the giver's toast rides under the chip in their words for three seconds, then goes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const view = engineView();
      const { store } = await standing("place.yaba", view);
      const done = { ...view, chapter: { ...view.chapter, items: view.chapter.items.map((item, index) => ({ ...item, met: index === 0 ? true : item.met })) } };
      act(() => {
        store.setState({ view: done });
      });
      const left = done.chapter.items.filter((item) => !item.met).length;
      expect(found("[data-brief-toast]").textContent).toContain(doneToast(left));
      expect(found("[data-brief-toast]").textContent).toContain(say("chapter.find-your-feet.brief.giver"));
      expect(found("[data-brief-chip] [data-dot='done']")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(DONE_TOAST_MS + 50);
      });
      expect(document.querySelector("[data-brief-toast]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("[world:nudge-says-one-thing] [world:things-are-tappable-models] given the giver's toast under the chip, when a finger rests on it past its time, then it stays, and goes once let go with the time it had left, as the other toasts do", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const view = engineView();
      const { store } = await standing("place.yaba", view);
      const done = { ...view, chapter: { ...view.chapter, items: view.chapter.items.map((item, index) => ({ ...item, met: index === 0 ? true : item.met })) } };
      act(() => {
        store.setState({ view: done });
      });
      const toast = found("[data-brief-toast]");
      fireEvent.pointerDown(toast);
      act(() => {
        vi.advanceTimersByTime(DONE_TOAST_MS * 3);
      });
      expect(document.querySelector("[data-brief-toast]")).not.toBeNull();
      fireEvent.pointerUp(found("[data-brief-toast]"));
      act(() => {
        vi.advanceTimersByTime(DONE_TOAST_MS + 50);
      });
      expect(document.querySelector("[data-brief-toast]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("[world:nudge-says-one-thing] given a chapter that closes while the world is open, when nothing covers it, then the brief comes back with every tick and its stamp, the next brief stands as a picture card, and Let's go hands it", async () => {
    const view = engineView();
    const { store } = await standing("place.family-house", view);
    const next = { ...view, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }, { id: "transcript", met: false }, { id: "english", met: false }, { id: "offer", met: false }], done: ["chapter.find-your-feet" as const], closes: false, next: "chapter.decision-day" as const } };
    act(() => {
      store.setState({ view: next });
    });
    const close = found("[data-brief-close='chapter.find-your-feet']");
    expect(close.querySelectorAll("[data-brief-tick]").length).toBe(view.chapter.items.length);
    expect(close.querySelector("[data-brief-stamp]")?.textContent).toBe(say("ui.brief.done"));
    expect(close.querySelector("[data-brief-next-card]")?.getAttribute("data-brief-next-card")).toBe("chapter.build-the-file");
    fireEvent.click(found("[data-brief-close-go]"));
    expect(document.querySelector("[data-brief-close]")).toBeNull();
    expect(found("[data-brief-chip]").dataset.briefChip).toBe("handed");
  });
});

describe("the notes' lane in the world", () => {
  test("[city:places-load-on-entry] given the world up, when the place's notes lane is drawn, then it starts under the band and not behind it", async () => {
    await standing("place.family-house");
    const lane = found("[data-notes-lane]");
    expect(lane.className).toContain("mt-[72px]");
  });

});
