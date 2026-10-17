// The bag by the door read as japacity (world.md R-WORLD-029, japacity.md R-JAPACITY-003): one model,
// scaled from the figure about its own spot and eased toward a new size so a rise is seen; what is
// held sits on top; a small tag on the handle carries the figure; the probe reports the scale.
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen } from "@testing-library/react";
import { Vector3 } from "three";
import { afterEach, describe, expect, test } from "vitest";

import parlourRaw from "../../../public/assets/places/home-family-house/place.json";
import roomRaw from "../../../public/assets/places/the-room/place.json";
import { engineView, recordedGame, recordedSave } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { BAG_EASE_SECONDS, BAG_EMPTY, BAG_FILE, BAG_FULL, BAG_HEIGHT, bagMatrix, bagPieces, bagScale, bagShare, bagSpot, easeBag, reportBag, tagWords } from "./Bag";
import { City } from "./City";
import { type PlaceFile, stageOf } from "./placeFile";
import type { CityProbe } from "./scene.types";

const ROOMS = [parlourRaw, roomRaw] as unknown as PlaceFile[];
const FRAME = 1 / 60;

/** Ada's careful life played on, command by command, until `held` says the view has what the test needs. */
function adaUntil(held: (view: PlayerView) => boolean): PlayerView {
  const save = recordedSave("ada-careful");
  // Played once from the start, a command at a time, rather than replayed from the start for each step (the lives grew with decision 0012).
  const game = recordedGame("ada-careful", save.commands.length);
  if (held(game.view())) return game.view();
  for (const entry of save.commands) {
    game.tick = entry.tick;
    game.accept(entry.command, entry.sender);
    const view = game.view();
    if (held(view)) return view;
  }
  throw new Error("Ada's careful life never got there");
}

afterEach(() => {
  delete window.__city;
});

describe("the bag's size from the figure", () => {
  test("[R-WORLD-031] [R-WORLD-029] [R-JAPACITY-003] given the figure, when the bag's scale is read, then it is smallest at 0 and with no route yet, full at 100, and grows with every point between", () => {
    expect(bagShare(null)).toBe(0);
    expect(bagShare(0)).toBe(0);
    expect(bagShare(100)).toBe(1);
    expect(bagScale(0)).toEqual(BAG_EMPTY);
    expect(bagScale(null)).toEqual(BAG_EMPTY);
    expect(bagScale(100)).toEqual(BAG_FULL);
    for (let percent = 1; percent <= 100; percent += 1) {
      const [x, y, z] = bagScale(percent);
      const [px, py, pz] = bagScale(percent - 1);
      expect(y).toBeGreaterThan(py);
      expect(x).toBeGreaterThanOrEqual(px);
      expect(z).toBeGreaterThanOrEqual(pz);
    }
    // It swells most in its height: an empty bag sags, a full one stands.
    expect(BAG_FULL[1] / BAG_EMPTY[1]).toBeGreaterThan(BAG_FULL[0] / BAG_EMPTY[0]);
  });

  test("[R-WORLD-031] [R-WORLD-029] given both rooms, when the bag is found, then each has the one bag model by the door, and scaling it keeps its foot on its spot and lifts its top to the scaled height", () => {
    for (const file of ROOMS) {
      const stage = stageOf(file);
      expect(stage.models.filter((model) => model.file === BAG_FILE).flatMap((model) => model.at)).toHaveLength(1);
      const spot = bagSpot(stage);
      if (spot === null) throw new Error(`${file.place}: no bag`);
      const [x, z] = spot;
      const matrix = bagMatrix(spot, bagScale(100));
      expect(new Vector3(x, 0, z).applyMatrix4(matrix).distanceTo(new Vector3(x, 0, z))).toBeLessThan(1e-9);
      const top = new Vector3(x, BAG_HEIGHT, z).applyMatrix4(matrix);
      expect(top.y).toBeCloseTo(BAG_HEIGHT * BAG_FULL[1], 9);
      expect(Math.hypot(top.x - x, top.z - z)).toBeLessThan(1e-9);
      // The bag's long side, along its own x, swells along its own x however the room has it turned.
      const end = new Vector3(0.45, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), spot[2]).add(new Vector3(x, 0, z));
      expect(end.clone().applyMatrix4(bagMatrix(spot, bagScale(0))).distanceTo(new Vector3(x, 0, z))).toBeCloseTo(0.45 * BAG_EMPTY[0], 9);
    }
  });

  test("[R-WORLD-031] [R-WORLD-029] given a rise of the figure, when the bag eases toward its new size, then it has not jumped after one frame and stands within a twentieth of it after about half a second", () => {
    let share = bagShare(20);
    const goal = bagShare(29);
    share = easeBag(share, goal, FRAME);
    expect(share).toBeGreaterThan(bagShare(20));
    expect((share - bagShare(20)) / (goal - bagShare(20))).toBeLessThan(0.15);
    for (let at = FRAME; at < BAG_EASE_SECONDS; at += FRAME) share = easeBag(share, goal, FRAME);
    expect(Math.abs(goal - share) / (goal - bagShare(20))).toBeLessThan(0.05);
    // A fall shrinks it the same way, and a long frame never overshoots.
    expect(easeBag(goal, bagShare(10), FRAME)).toBeLessThan(goal);
    expect(easeBag(bagShare(10), goal, 5)).toBe(goal);
  });
});

describe("what is packed on top", () => {
  test("[R-WORLD-031] [R-WORLD-029] given a new life with nothing held, when the pieces are read, then nothing is on top; Tunde, who holds his passport from the start, has it there", () => {
    expect(bagPieces(engineView("scenario.ada"))).toEqual([]);
    expect(bagPieces(engineView("scenario.tunde"))).toEqual(["passport"]);
  });

  test("[R-WORLD-031] [R-WORLD-029] given Ada's careful life, when a route is known and then her papers come, then the flyer goes on top first and the passport and the papers join it, three pieces and no more", () => {
    const known = adaUntil((view) => view.routes.some((route) => route.state === "known"));
    expect(bagPieces(known)).toEqual(["flyer"]);
    const papers = adaUntil((view) => view.documents.filter((paper) => paper.state === "held").length >= 2);
    expect(bagPieces(papers)).toEqual(["passport", "papers", "flyer"]);
    const later = adaUntil((view) => view.documents.filter((paper) => paper.state === "held").length >= 5);
    expect(bagPieces(later)).toEqual(["passport", "papers", "flyer"]);
  });

  test("[R-WORLD-031] [R-WORLD-029] given a route only heard of, when the pieces are read, then no flyer: only a route known, applied for, granted or flown on puts it on top", () => {
    const base = engineView("scenario.ada");
    const route = base.routes[0];
    if (route === undefined) throw new Error("No route");
    const as = (state: PlayerView["routes"][number]["state"]) => bagPieces({ ...base, routes: [{ ...route, state }] });
    expect(as("heard")).toEqual([]);
    expect(as("unknown")).toEqual([]);
    expect(as("refused")).toEqual([]);
    for (const state of ["known", "applying", "granted", "departed"] as const) expect(as(state)).toEqual(["flyer"]);
  });
});

describe("the tag and the probe", () => {
  test("[R-WORLD-031] [R-WORLD-029] [R-JAPACITY-003] given the figure, when the tag is drawn, then it carries the figure as the band would, and with no route yet it carries none", () => {
    // The figure alone, as the rise's "+N" says it, never a percentage.
    expect(tagWords(0)).toBe("0");
    expect(tagWords(41)).toBe("41");
    expect(tagWords(100)).toBe("100");
    for (const figure of [0, 41, 100]) expect(tagWords(figure)).not.toContain("%");
    expect(tagWords(null)).toBeNull();
  });

  test("[R-WORLD-031] [R-WORLD-029] given the city's probe, when a frame of the bag is reported, then the browser test reads the bag's scale, its goal, the figure and the pieces", () => {
    window.__city = { place: "place.family-house" } as CityProbe;
    reportBag({ share: 0.5, goal: 0.6, figure: 60, pieces: ["flyer"] });
    expect(window.__city.bag).toEqual({ share: 0.5, goal: 0.6, scale: bagScaleAt(0.5), figure: 60, pieces: ["flyer"] });
    delete window.__city;
    expect(() => reportBag({ share: 0.5, goal: 0.6, figure: 60, pieces: [] })).not.toThrow();
  });
});

describe("the rise in the world", () => {
  /** Ada a few months in with a way out known, and the same life further on with the figure risen. */
  function figures(): { before: PlayerView; after: PlayerView } {
    const before = adaUntil((view) => view.japacity.percent !== null && view.report !== null);
    const after = adaUntil((view) => (view.japacity.percent ?? 0) > (before.japacity.percent ?? 0) && view.report !== null);
    return { before, after };
  }

  test("[R-WORLD-031] [R-WORLD-029] [R-JAPACITY-003] given the world in view, when the figure rises, then one rise flies over it for the gain; with the phone up over the world it waits until the phone is put away", async () => {
    const { before, after } = figures();
    const { store } = await renderWithView(<City world />, before);
    expect(document.querySelector("[data-rise]")).toBeNull();
    act(() => store.setState({ view: after }));
    expect(document.querySelector("[data-rise]")?.textContent).toBe(`+${String((after.japacity.percent ?? 0) - (before.japacity.percent ?? 0))}`);
    document.body.innerHTML = "";
    const again = await renderWithView(<City world phone={(close) => <button type="button" onClick={close} data-put-away />} />, before);
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.phone") }));
    act(() => again.store.setState({ view: after }));
    expect(document.querySelector("[data-rise]")).toBeNull();
    const putAway = document.querySelector<HTMLElement>("[data-put-away]");
    if (putAway === null) throw new Error("No phone");
    fireEvent.click(putAway);
    expect(document.querySelector("[data-rise]")).not.toBeNull();
  });
});

/** The scale at a share of the way from empty to full. */
function bagScaleAt(share: number): [number, number, number] {
  return [0, 1, 2].map((axis) => (BAG_EMPTY[axis] ?? 0) + ((BAG_FULL[axis] ?? 0) - (BAG_EMPTY[axis] ?? 0)) * share) as [number, number, number];
}
