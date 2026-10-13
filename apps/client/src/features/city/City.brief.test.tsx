// The road in the world, only in the moment (docs/design/13-the-lively-layer.md section 4; the plan 16; the road set's
// pictures 01 to 05): nothing under the band by default; at the step's place the brief's chip with its dots and the marker
// on the thing to do; a thing done ticks its dot and the giver says so under the chip for three seconds; walking out takes
// the chip away; a chapter closed brings the brief back with its stamp and the next brief as a picture card.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import type { Act, Thing } from "../../shared/world/contract";
import { markTaught } from "../../shared/world/taught";
import { DONE_TOAST_MS, doneToast } from "./brief/brief";
import { City } from "./City";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

interface StandInProps {
  things?: Thing[];
  chosen?: Thing | null;
  actOn?: { thing: Thing; act: Act; at: number } | null;
  onPick: (pick: Pick) => void;
}

function StandInScene({ things, chosen = null, actOn = null, onPick }: StandInProps) {
  // The walk is instant here: the act follows the fan's tap at once, as it would on arrival (R-WORLD-010).
  useEffect(() => {
    if (actOn !== null) onPick({ kind: "act", thing: actOn.thing, act: actOn.act });
  }, [actOn]);
  return (
    <div data-stand-in-scene data-stand-in-chosen={chosen?.id ?? ""}>
      {(things ?? []).map((thing) => (
        <span key={thing.id}>
          <button type="button" data-stand-in-thing={thing.id} onClick={() => onPick({ kind: "thing", thing })} />
          {thing.acts.map((one) => (
            <button key={one.id} type="button" data-stand-in-act={`${thing.id}:${one.id}`} onClick={() => onPick({ kind: "act", thing, act: one })} />
          ))}
        </span>
      ))}
    </div>
  );
}

vi.mock("./CityScene", () => ({ default: StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => {
  const real = await original<typeof import("../../shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "..", "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

const SCREEN = { width: window.innerWidth, height: window.innerHeight };

beforeEach(() => {
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  
  // A phone held upright, as the game is built for.
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  Object.defineProperty(window, "innerWidth", { value: SCREEN.width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: SCREEN.height, configurable: true });
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}


const world = () => <City world results={(place) => <p data-results-for={place} />} />;

/** A fresh life whose first brief was handed in an earlier visit, standing at `place`. */
async function standing(place: string, view = engineView()) {
  markTaught("title", view.scenario);
  window.localStorage.setItem("japacity.city.last", JSON.stringify([place]));
  const rendered = await renderWithView(world(), view);
  await waitFor(() => found("[data-stand-in-scene] [data-stand-in-thing]"), { timeout: 3000 });
  return rendered;
}

describe("the road in the world, only in the moment", () => {
  test("[R-WORLD-003] given the first brief carried and the player at home, away from its place, when the world shows, then nothing stands under the band and no marker stands anywhere", async () => {
    await standing("place.family-house");
    expect(document.querySelector("[data-band] [data-nudge]")).toBeNull();
    expect(document.querySelector("[data-marker]")).toBeNull();
  });

  test("[R-WORLD-003] [R-WORLD-005] given the player at the hub where the brief's first thing is done, when the world shows, then the chip names the brief with a dot for each thing, the marker stands on the board with the thing to do, and the chip's tap opens the board's acts", async () => {
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
    expect(found("[data-stand-in-scene]").dataset.standInChosen).toBe("jobs");
  });

  test("[R-WORLD-003] [R-WORLD-005] given the marker on the step's thing, when its pill is tapped, then the thing is picked as the chip's tap picks it, whoever stands in front of the thing", async () => {
    await standing("place.yaba", engineView());
    await waitFor(() => found("[data-marker-tap]"));
    fireEvent.click(found("[data-marker-tap='jobs']"));
    expect(found("[data-stand-in-scene]").dataset.standInChosen).toBe("jobs");
  });

  test("[R-WORLD-003] given the chip at the step's place, when a thing comes in, then its dot ticks, the giver's toast rides under the chip in their words for three seconds, then goes", async () => {
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

  test("[R-WORLD-003] given a chapter that closes while the world is open, when nothing covers it, then the brief comes back with every tick and its stamp, the next brief stands as a picture card, and Let's go hands it", async () => {
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
