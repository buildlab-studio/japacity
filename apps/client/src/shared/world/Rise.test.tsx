// The rise (japacity:best-open-route-is-japacity, world:motions-under-half-second): every
// rise of the figure flies up as "+9" in the band's colours toward the band and fades, one at a time and
// never a queue; a fall shows nothing; while a sheet covers the world the figure waits, so the rise and
// the bag's growth are seen together once it closes. Each motion is under half a second.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { recordedGame, recordedSave } from "../testing/fixtures";
import { Rise, RISE_FLY_MS, RISE_MS, riseOf, useJapaRise } from "./Rise";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ percent, open }: { percent: number | null; open: boolean }) {
  const japa = useJapaRise(percent, open);
  return (
    <>
      <Rise rise={japa.rise} />
      <i data-figure={japa.figure ?? "none"} />
    </>
  );
}

const rises = (): string[] => [...document.querySelectorAll("[data-rise]")].map((node) => node.textContent);
const figure = (): string | null => document.querySelector("[data-figure]")?.getAttribute("data-figure") ?? null;

describe("the rise of the figure", () => {
  test("[world:japacity-bag-by-door] [japacity:best-open-route-is-japacity] given the figure before and after, when a rise is read, then it is the points gained; the first figure of a route known counts from nothing; a fall or no change is no rise", () => {
    expect(riseOf(20, 29)).toBe(9);
    expect(riseOf(null, 10)).toBe(10);
    expect(riseOf(29, 20)).toBe(0);
    expect(riseOf(20, 20)).toBe(0);
    expect(riseOf(10, null)).toBe(0);
  });

  test("[world:japacity-bag-by-door] [japacity:best-open-route-is-japacity] given Tunde the borrower's life, when every month's figure is read in turn, then each rise is its gain and every fall is no rise", () => {
    const commands = recordedSave("banker-borrower").commands.length;
    const figures: (number | null)[] = [];
    for (let played = 0; played <= commands; played += 1) figures.push(recordedGame("banker-borrower", commands - played).view().japacity.percent);
    const changes = figures.slice(1).map((now, index) => ({ before: figures[index] ?? null, now })).filter(({ before, now }) => before !== now);
    const gains = changes.filter(({ before, now }) => now !== null && now > (before ?? 0));
    const falls = changes.filter(({ before, now }) => now === null || (before !== null && now < before));
    expect(gains.length).toBeGreaterThan(5);
    expect(falls.length).toBeGreaterThan(0);
    expect(gains.map(({ before, now }) => riseOf(before, now))).toEqual(gains.map(({ before, now }) => (now ?? 0) - (before ?? 0)));
    expect(falls.map(({ before, now }) => riseOf(before, now))).toEqual(falls.map(() => 0));
  }, 30000);

  test("[world:japacity-bag-by-door] [japacity:best-open-route-is-japacity] [world:motions-under-half-second] given the world in view, when the figure rises, then one rise flies once in the band's colours and is gone after its time; when it falls, nothing flies and only the figure the bag reads moves", () => {
    const shown = render(<Harness percent={20} open />);
    expect(rises()).toEqual([]);
    expect(figure()).toBe("20");
    shown.rerender(<Harness percent={29} open />);
    expect(rises()).toEqual(["+9"]);
    expect(document.querySelector("[data-rise] .band")).not.toBeNull();
    expect(figure()).toBe("29");
    act(() => {
      vi.advanceTimersByTime(RISE_MS);
    });
    expect(rises()).toEqual([]);
    shown.rerender(<Harness percent={24} open />);
    expect(rises()).toEqual([]);
    expect(figure()).toBe("24");
    shown.rerender(<Harness percent={24} open />);
    expect(rises()).toEqual([]);
  });

  test("[world:japacity-bag-by-door] [japacity:best-open-route-is-japacity] given a sheet over the world, when the figure rises under it, then nothing flies and the bag keeps its size until it closes; then one rise flies for the whole gain", () => {
    const shown = render(<Harness percent={20} open />);
    shown.rerender(<Harness percent={26} open={false} />);
    shown.rerender(<Harness percent={31} open={false} />);
    expect(rises()).toEqual([]);
    expect(figure()).toBe("20");
    shown.rerender(<Harness percent={31} open />);
    expect(rises()).toEqual(["+11"]);
    expect(figure()).toBe("31");
  });

  test("[world:japacity-bag-by-door] [japacity:best-open-route-is-japacity] given a rise still flying, when the figure rises again, then the new one takes its place: one at a time, never a queue", () => {
    const shown = render(<Harness percent={30} open />);
    shown.rerender(<Harness percent={33} open />);
    shown.rerender(<Harness percent={40} open />);
    expect(rises()).toEqual(["+7"]);
    act(() => {
      vi.advanceTimersByTime(RISE_MS);
    });
    expect(rises()).toEqual([]);
  });

  test("[world:japacity-bag-by-door] [world:motions-under-half-second] given the rise, then its flight is under half a second; it pops in with the shell's pop and holds still between", () => {
    expect(RISE_FLY_MS).toBeLessThan(500);
    const shown = render(<Harness percent={30} open />);
    shown.rerender(<Harness percent={39} open />);
    expect(document.querySelector("[data-rise] .pop")).not.toBeNull();
    const flier = document.querySelector<HTMLElement>("[data-rise] .band");
    expect(flier?.className).toContain(`duration-${String(RISE_FLY_MS)}`);
    expect(document.querySelector("[data-rise]")?.getAttribute("data-flying")).toBe("false");
    act(() => {
      vi.advanceTimersByTime(RISE_MS - RISE_FLY_MS);
    });
    expect(document.querySelector("[data-rise]")?.getAttribute("data-flying")).toBe("true");
  });
});
