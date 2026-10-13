import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { AGREE_FRAMES, type Device, enterPlace, type FrameWatch, keepChoice, modeSettings, observeFrame, readChoice, startingMode, watchFrames, WINDOW_FRAMES } from "./mode";

const city = content.tuning.city;
const phone: Device = { finePointer: false, width: 412, pixelRatio: 3 };
const desktop: Device = { finePointer: true, width: city.desktopMinWidth, pixelRatio: 3 };

/** `good` frames of `goodMs` then the rest of a window at `badMs`, fed after `before` frames of `fillMs`. */
function feed(watch: FrameWatch, frames: number[]): FrameWatch {
  return frames.reduce((current, frame) => observeFrame(current, frame, city), watch);
}

function windowOf(good: number, goodMs: number, badMs: number): number[] {
  return [...Array.from({ length: good }, () => goodMs), ...Array.from({ length: WINDOW_FRAMES - good }, () => badMs)];
}

/** Enough frames at `ms` to pass `afterMs` in the place. */
function waitFor(afterMs: number, ms: number): number[] {
  return Array.from({ length: Math.ceil(afterMs / ms) }, () => ms);
}

describe("starting mode", () => {
  test("[R-CITY-019] given a phone with a sharp screen and enough memory, or a memory the browser keeps to itself, when the city opens, then it starts in high; a coarse screen or little memory starts in low", () => {
    expect(startingMode({ ...phone, pixelRatio: 3 }, city)).toBe("high");
    expect(startingMode({ ...phone, pixelRatio: 3, memory: null }, city)).toBe("high");
    expect(startingMode({ ...phone, pixelRatio: 3, memory: 4 }, city)).toBe("high");
    expect(startingMode({ ...phone, pixelRatio: 3, memory: 2 }, city)).toBe("low");
    expect(startingMode({ ...phone, pixelRatio: 1 }, city)).toBe("low");
    expect(startingMode({ ...desktop, finePointer: false, pixelRatio: 1 }, city)).toBe("low");
  });

  test("[R-CITY-019] given a fine pointer, when the window is at the desktop width it starts in high; one pixel under, it is judged as a phone is, by its screen and memory", () => {
    expect(startingMode(desktop, city)).toBe("high");
    expect(startingMode({ ...desktop, width: city.desktopMinWidth - 1, pixelRatio: 1 }, city)).toBe("low");
    expect(startingMode({ ...desktop, width: city.desktopMinWidth - 1, pixelRatio: 2 }, city)).toBe("high");
  });

  test("[R-CITY-019] given the player fixed a mode in settings, when the city opens on any device, then that mode is used and kept per device", () => {
    expect(startingMode(phone, city, "high")).toBe("high");
    expect(startingMode(desktop, city, "low")).toBe("low");
    const kept = new Map<string, string>();
    const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) };
    expect(readChoice(storage)).toBe("auto");
    keepChoice(storage, "low");
    expect(readChoice(storage)).toBe("low");
    expect(readChoice(null)).toBe("auto");
  });
});

describe("rising and dropping", () => {
  const raiseMs = city.raiseFrameMs;
  const slowMs = city.dropFrameMs + 1;

  test(`[R-CITY-019] given low after raiseAfterMs, when ${String(AGREE_FRAMES)} of 100 frames took at most raiseFrameMs, then it rises to high`, () => {
    const waited = feed(watchFrames("low", false), waitFor(city.raiseAfterMs, slowMs));
    expect(waited.mode).toBe("low");
    expect(feed(waited, windowOf(AGREE_FRAMES, raiseMs, raiseMs + 1)).mode).toBe("high");
  });

  test(`[R-CITY-019] given low after raiseAfterMs, when only ${String(AGREE_FRAMES - 1)} of 100 frames were fast enough, then it stays low`, () => {
    const waited = feed(watchFrames("low", false), waitFor(city.raiseAfterMs, slowMs));
    expect(feed(waited, windowOf(AGREE_FRAMES - 1, raiseMs, raiseMs + 1)).mode).toBe("low");
  });

  test("[R-CITY-019] given low for less than raiseAfterMs in a place, when every frame is fast, then it stays low", () => {
    const frames = Array.from({ length: WINDOW_FRAMES }, () => 1);
    const watch = feed(watchFrames("low", false), frames);
    expect(watch.elapsedMs).toBeLessThan(city.raiseAfterMs);
    expect(watch.mode).toBe("low");
    expect(feed(enterPlace(watch), frames).elapsedMs).toBe(WINDOW_FRAMES);
  });

  test(`[R-CITY-019] given high after dropAfterMs, when ${String(AGREE_FRAMES)} of 100 frames took more than dropFrameMs, then it drops to low for the session`, () => {
    const waited = feed(watchFrames("high", false), waitFor(city.dropAfterMs, 1));
    const dropped = feed(waited, windowOf(WINDOW_FRAMES - AGREE_FRAMES, city.dropFrameMs, slowMs));
    expect(dropped.mode).toBe("low");
    expect(dropped.fixed).toBe(true);
    const later = feed(dropped, [...waitFor(city.raiseAfterMs, 1), ...windowOf(WINDOW_FRAMES, 1, 1)]);
    expect(later.mode).toBe("low");
  });

  test(`[R-CITY-019] given high after dropAfterMs, when ${String(AGREE_FRAMES - 1)} of 100 frames were too slow, then it stays high`, () => {
    const waited = feed(watchFrames("high", false), waitFor(city.dropAfterMs, 1));
    expect(feed(waited, windowOf(WINDOW_FRAMES - AGREE_FRAMES + 1, city.dropFrameMs, slowMs)).mode).toBe("high");
  });

  test("[R-CITY-019] given a mode the player fixed, when every frame is slow, then it never moves", () => {
    const frames = [...waitFor(city.dropAfterMs, slowMs), ...windowOf(0, 1, slowMs)];
    expect(feed(watchFrames("high", true), frames).mode).toBe("high");
  });
});

describe("the table", () => {
  test("[R-CITY-019] given each mode, when its settings are read, then pixel ratio, shadows, crowd, fog, atmosphere, antialiasing and mesh follow the table", () => {
    const low = modeSettings("low", desktop, city);
    const high = modeSettings("high", desktop, city);
    expect(low).toMatchObject({ pixelRatio: 1, shadows: false, crowd: city.crowdLow, atmosphere: false, antialias: false, mesh: "coarse" });
    expect(high).toMatchObject({ pixelRatio: city.maxPixelRatio, shadows: true, crowd: city.crowdHigh, atmosphere: true, antialias: true, mesh: "fine" });
    expect(low.fog.far).toBeLessThan(high.fog.far);
    expect(modeSettings("high", { ...desktop, pixelRatio: 1 }, city).pixelRatio).toBe(1);
  });
});
