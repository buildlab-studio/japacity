// Lagos from the air (world:map-is-painted-lagos, world:reach-and-read): how many roofs and windows the paper holds,
// the layout laid in slices that keep to their budget and lay every square in the end, the same roofs from the same
// seed whatever the order, each roof path held once, the windows lit at night alone, and every name readable against
// what it lies on by day and by night.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CARDS } from "../districts";
import { groundOf } from "../draw";
import { LAND, LANTERN_CANOE, LANTERN_CANOE_CLEAR } from "../geometry";
import { inside as pointIn } from "../scatter";
import { contrast, over, queuedJob, token } from "./aerial.testing";
import { AerialSvg } from "./AerialSvg";
import { lagosAerial } from "./job";
import { AERIAL, laySkeleton, type Square } from "./layout";

const WHOLE = [-1000, -1000, 2000, 3000] as const;
/** Surulere's card and the island's, as a phone's card shows them, on the paper. */
const SURULERE = [200, 760, 360, 980] as const;
const ISLAND = [400, 1150, 600, 1350] as const;
const inside = (key: string, box: readonly [number, number, number, number]): boolean => {
  const [sx, sy] = key.split(",").map(Number) as [number, number];
  return sx * 120 < box[2] && sx * 120 + 120 > box[0] && sy * 120 < box[3] && sy * 120 + 120 > box[1];
};

/** Every square of a job laid to its end, wanted by one view over `box`. */
function laidAll(box: readonly [number, number, number, number] = WHOLE, tuning = AERIAL, clock?: () => number): { squares: ReadonlyMap<string, Square>; slices: readonly number[]; order: string[] } {
  const { job, drain } = queuedJob(tuning, clock);
  const order: string[] = [];
  job.subscribe(() => {
    for (const key of job.squares().keys()) if (!order.includes(key)) order.push(key);
  });
  job.want("view", { box, weight: 3 });
  drain();
  expect(job.done()).toBe(true);
  return { squares: job.squares(), slices: job.slices(), order };
}

describe("Lagos from the air, laid in idle slices", () => {
  test("[world:map-is-painted-lagos] given the whole paper laid, then it holds at most 5,000 roofs and at most 320 lit windows, the roofs packed at each card's heart and thinning toward the edges", () => {
    const { squares } = laidAll();
    const roofs = [...squares.values()].reduce((sum, square) => sum + square.count.roofs, 0);
    const windows = [...squares.values()].reduce((sum, square) => sum + square.count.windows, 0);
    expect(roofs).toBeLessThanOrEqual(5000);
    expect(roofs).toBeGreaterThan(3500);
    expect(windows).toBeLessThanOrEqual(320);
    expect(windows).toBeGreaterThan(200);
    // The squares at a card's heart against those far from every card, among the squares with roofs at all.
    const away = (square: Square): number => Math.min(...CARDS.map((card) => Math.hypot(square.sx * 120 + 60 - card.centre[0], square.sy * 120 + 60 - card.centre[1]) / (17500 / card.zoom)));
    const built = [...squares.values()].filter((square) => square.count.roofs > 0);
    const mean = (list: Square[]): number => list.reduce((sum, square) => sum + square.count.roofs, 0) / Math.max(1, list.length);
    const heart = built.filter((square) => away(square) < 0.9);
    const far = built.filter((square) => away(square) > 2.5);
    expect(heart.length).toBeGreaterThan(3);
    expect(far.length).toBeGreaterThan(3);
    expect(mean(heart)).toBeGreaterThan(mean(far) * 1.5);
  });

  test("[world:map-is-painted-lagos] given a clock that moves one step at each yield, when the layout runs in slices of six, then no slice runs past its budget and every square is laid in the end", () => {
    let ticks = 0;
    const { squares, slices } = laidAll(WHOLE, AERIAL, () => (ticks += 1));
    expect(slices.length).toBeGreaterThan(500);
    expect(Math.max(...slices)).toBeLessThanOrEqual(6);
    const skeleton = laySkeleton(groundOf());
    let result = skeleton.next();
    while (result.done !== true) result = skeleton.next();
    expect([...squares.keys()].sort()).toEqual(result.value.squares.map(([sx, sy]) => `${String(sx)},${String(sy)}`).sort());
  });

  test("[world:map-is-painted-lagos] given the same seed, when the squares are laid in another order and in other slices, then each holds the same roofs, windows, lanes and waves; another seed lays another city", () => {
    const first = laidAll(SURULERE);
    // The island's card first, and slices a step long.
    let ticks = 0;
    const second = laidAll(ISLAND, AERIAL, () => (ticks += 6));
    expect(inside(first.order[0] ?? "", SURULERE)).toBe(true);
    expect(inside(second.order[0] ?? "", ISLAND)).toBe(true);
    expect(second.squares).toEqual(first.squares);
    const other = laidAll(WHOLE, { ...AERIAL, seed: AERIAL.seed + 1 });
    expect(other.squares.get("2,7")?.roofs).not.toEqual(first.squares.get("2,7")?.roofs);
  });

  test("[world:map-is-painted-lagos] given the layout on this machine's clock, then the work between two yields stays a small part of a frame, so a slice ends close to its budget", () => {
    // The least of three runs, so a run the machine paused part way cannot speak for the layout.
    const runs = [0, 1, 2].map(() => {
      const { job, drain } = queuedJob(AERIAL, () => performance.now());
      job.want("view", { box: WHOLE, weight: 1 });
      drain();
      const sorted = [...job.slices()].sort((a, b) => a - b);
      return { median: sorted[Math.floor(sorted.length / 2)] ?? 0, high: sorted[Math.floor(sorted.length * 0.99)] ?? 0 };
    });
    expect(Math.min(...runs.map((run) => run.median))).toBeLessThanOrEqual(8);
    expect(Math.min(...runs.map((run) => run.high))).toBeLessThanOrEqual(12);
  });

  test("[world:map-is-painted-lagos] given no view wanting the layout, then it lays nothing; once a view wants it, the squares that view shows are laid first", () => {
    let ticks = 0;
    const { job, drain } = queuedJob(AERIAL, () => (ticks += 1));
    expect(drain()).toBe(0);
    job.want("card", { box: ISLAND, weight: 3 });
    for (let tries = 0; tries < 10_000 && job.squares().size === 0; tries += 1) drain(1);
    const [key] = [...job.squares().keys()];
    expect(inside(key ?? "", ISLAND)).toBe(true);
    job.unwant("card");
    expect(drain()).toBeLessThanOrEqual(1);
    expect(job.done()).toBe(false);
  });
});

describe("the water from the air", () => {
  test("[world:lantern-canoe-on-map] given the layout from the air, then its waves lie on open water and none is drawn within 22 units of the lantern canoe", () => {
    const { squares } = laidAll();
    const waves = [...squares.values()].flatMap((square) => [...square.waves.matchAll(/M(-?[\d.]+),(-?[\d.]+)q/g)].map((match) => [Number(match[1]) + 6, Number(match[2])] as const));
    expect(waves.length).toBeGreaterThan(150);
    const [cx, cy] = LANTERN_CANOE.at;
    for (const [x, y] of waves) expect(Math.hypot(x - cx, y - cy)).toBeGreaterThanOrEqual(LANTERN_CANOE_CLEAR);
    const land = Object.values(LAND);
    for (const [x, y] of waves) expect(land.some((piece) => pointIn(piece, [Math.round(x), Math.round(y)]))).toBe(false);
  });
});

describe("drawn from the air", () => {
  test("[world:map-is-painted-lagos] given a card with its squares laid, when it is drawn, then each roof path stands once in the page and the lit edge is drawn from it by reference", async () => {
    const { container } = render(<AerialSvg variant="card" uid="card-test" within={SURULERE} weight={3} />);
    await vi.waitFor(() => expect(lagosAerial().done()).toBe(true), { timeout: 60_000, interval: 50 });
    await vi.waitFor(() => expect(container.querySelectorAll("[data-square]").length).toBeGreaterThan(2));
    const roofs = [...container.querySelectorAll(".roofs path[id]")];
    const shapes = roofs.map((path) => path.getAttribute("d") ?? "");
    expect(new Set(shapes).size).toBe(shapes.length);
    const uses = [...container.querySelectorAll(".roof-lit use")];
    expect(uses.length).toBe(roofs.length);
    for (const use of uses) expect(container.querySelector(`[id="${(use.getAttribute("href") ?? "").slice(1)}"]`)).not.toBeNull();
    // No roof stands twice: the lit edge holds no path data of its own.
    expect(container.querySelectorAll(".roof-lit path")).toHaveLength(0);
  }, 90_000);

  test("[world:map-is-painted-lagos] given the paints, when the map's colours are read, then the windows among the roofs are lit at night alone, and the main roads and the expressways stand clear of the ground by day and by night", () => {
    const css = readFileSync(join(import.meta.dirname, "aerial.css"), "utf8");
    expect(css).toMatch(/\.aerial \.lit \{[^}]*display: none;/);
    expect(css).toMatch(/\[data-paint="night"\] \.aerial \.lit \{ display: inline; \}/);
    for (const night of [false, true]) {
      expect(contrast(token(night, "--main"), token(night, "--map-paper"))).toBeGreaterThanOrEqual(3);
      expect(contrast(token(night, "--express"), token(night, "--map-paper"))).toBeGreaterThanOrEqual(3);
    }
    expect(token(true, "--main")).toBe("#7d7262");
  });
});

describe("the names from the air", () => {
  test("[world:map-is-painted-lagos] given every name the map paints, then it stands in the face's heavier weight over a dark halo 6 px wide", () => {
    const css = readFileSync(join(import.meta.dirname, "aerial.css"), "utf8");
    const rule = (selector: string): string => {
      const start = css.indexOf(`${selector} {`);
      expect(start).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf("}", start));
    };
    for (const selector of [".aerial .district", ".aerial .water-name", ".aerial .bridge-name.halo", ".street-names .street-name.halo"]) expect(rule(selector)).toContain("stroke-width: calc(6px / var(--z, 1))");
    for (const selector of [".aerial .district", ".aerial .water-name", ".aerial .bridge-name", ".street-names .street-name"]) expect(rule(selector)).toContain("font-weight: 700");
  });

  /** Everything a name may lie on: the ground, every roof, every road, the parks, the water and the sea. */
  const grounds = (night: boolean): string[] => ["--map-paper", "--roof-rust", "--roof-brown", "--roof-zinc", "--roof-old-zinc", "--roof-blue", "--roof-green", "--lane", "--minor", "--main", "--express", "--park", "--water", "--sea"].map((name) => token(night, name));

  test("[world:reach-and-read] given every name the map paints, by day and by night, then each meets 4.5 to 1 against its halo laid over anything it can lie on, and the blue dot's ring meets 3 to 1 on the ground", () => {
    const short: string[] = [];
    for (const night of [false, true]) {
      const pairs: [string, string, string][] = [
        ["district", "--label", "--halo"],
        ["street", "--street-name", "--street-halo"],
        ["water", "--waterl", "--water-halo"],
      ];
      for (const [what, ink, halo] of pairs) {
        for (const ground of grounds(night)) {
          const ratio = contrast(token(night, ink), over(token(night, halo), ground));
          if (ratio < 4.5) short.push(`${night ? "night" : "day"} ${what} on ${ground}: ${String(ratio)}`);
        }
      }
      expect(contrast(night ? "#e9f1ff" : "#ffffff", token(night, "--map-paper"))).toBeGreaterThanOrEqual(3);
    }
    expect(short).toEqual([]);
    // The pill where the player stands, by day and by night.
    expect(contrast("#1d5bb0", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#cfe0ff", "#1f2c4d")).toBeGreaterThanOrEqual(4.5);
  });
});
