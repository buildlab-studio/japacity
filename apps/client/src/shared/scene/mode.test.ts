import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { AGREE_FRAMES, type Device, enterPlace, type FrameWatch, judgeFrame, keepChoice, modeSettings, observeFrame, readChoice, type SceneFrame, SETTLE_FRAMES, startingMode, watchFrames, WINDOW_FRAMES } from "./mode";
import { memoryStorage } from "../testing/storage";

const city = content.tuning.city;
const phone: Device = { finePointer: false, width: 412, pixelRatio: 3 };
const desktop: Device = { finePointer: true, width: city.desktopMinWidth, pixelRatio: 3 };

/** The watch after each of `frames` in turn. */
function feed(watch: FrameWatch, frames: number[]): FrameWatch {
  return frames.reduce((current, frame) => observeFrame(current, frame, city), watch);
}

/** A window of `good` frames of `goodMs`, the rest at `badMs`. */
function windowOf(good: number, goodMs: number, badMs: number): number[] {
  return [...Array.from({ length: good }, () => goodMs), ...Array.from({ length: WINDOW_FRAMES - good }, () => badMs)];
}

/** Enough frames at `ms` to pass `afterMs` in the place. */
function waitFor(afterMs: number, ms: number): number[] {
  return Array.from({ length: Math.ceil(afterMs / ms) }, () => ms);
}

describe("starting mode", () => {
  test("[city:two-graphics-modes] given a phone with a sharp screen and enough memory, or a memory the browser keeps to itself, when the city opens, then it starts in high; a coarse screen or little memory starts in low", () => {
    expect(startingMode({ ...phone, pixelRatio: 3 }, city)).toBe("high");
    expect(startingMode({ ...phone, pixelRatio: 3, memory: null }, city)).toBe("high");
    expect(startingMode({ ...phone, pixelRatio: 3, memory: 4 }, city)).toBe("high");
    expect(startingMode({ ...phone, pixelRatio: 3, memory: 2 }, city)).toBe("low");
    expect(startingMode({ ...phone, pixelRatio: 1 }, city)).toBe("low");
    expect(startingMode({ ...desktop, finePointer: false, pixelRatio: 1 }, city)).toBe("low");
  });

  test("[city:two-graphics-modes] given a fine pointer, when the window is at the desktop width it starts in high; one pixel under, it is judged as a phone is, by its screen and memory", () => {
    expect(startingMode(desktop, city)).toBe("high");
    expect(startingMode({ ...desktop, width: city.desktopMinWidth - 1, pixelRatio: 1 }, city)).toBe("low");
    expect(startingMode({ ...desktop, width: city.desktopMinWidth - 1, pixelRatio: 2 }, city)).toBe("high");
  });

  test("[city:two-graphics-modes] given the player fixed a mode in settings, when the city opens on any device, then that mode is used and kept per device", () => {
    expect(startingMode(phone, city, "high")).toBe("high");
    expect(startingMode(desktop, city, "low")).toBe("low");
    const storage = memoryStorage();
    expect(readChoice(storage)).toBe("auto");
    keepChoice(storage, "low");
    expect(readChoice(storage)).toBe("low");
    expect(readChoice(null)).toBe("auto");
  });
});

describe("rising and dropping", () => {
  const raiseMs = city.raiseFrameMs;
  const slowMs = city.dropFrameMs + 1;

  test(`[city:two-graphics-modes] given low after raiseAfterMs, when ${String(AGREE_FRAMES)} of 100 frames took at most raiseFrameMs, then it rises to high`, () => {
    const waited = feed(watchFrames("low", false), waitFor(city.raiseAfterMs, slowMs));
    expect(waited.mode).toBe("low");
    expect(feed(waited, windowOf(AGREE_FRAMES, raiseMs, raiseMs + 1)).mode).toBe("high");
  });

  test(`[city:two-graphics-modes] given low after raiseAfterMs, when only ${String(AGREE_FRAMES - 1)} of 100 frames were fast enough, then it stays low`, () => {
    const waited = feed(watchFrames("low", false), waitFor(city.raiseAfterMs, slowMs));
    expect(feed(waited, windowOf(AGREE_FRAMES - 1, raiseMs, raiseMs + 1)).mode).toBe("low");
  });

  test("[city:two-graphics-modes] given low for less than raiseAfterMs in a place, when every frame is fast, then it stays low", () => {
    const frames = Array.from({ length: WINDOW_FRAMES }, () => 1);
    const watch = feed(watchFrames("low", false), frames);
    expect(watch.elapsedMs).toBeLessThan(city.raiseAfterMs);
    expect(watch.mode).toBe("low");
    expect(feed(enterPlace(watch), frames).elapsedMs).toBe(WINDOW_FRAMES);
  });

  test(`[city:two-graphics-modes] given high after dropAfterMs, when ${String(AGREE_FRAMES)} of 100 frames took more than dropFrameMs, then it drops to low for the session`, () => {
    const waited = feed(watchFrames("high", false), waitFor(city.dropAfterMs, 1));
    const dropped = feed(waited, windowOf(WINDOW_FRAMES - AGREE_FRAMES, city.dropFrameMs, slowMs));
    expect(dropped.mode).toBe("low");
    expect(dropped.fixed).toBe(true);
    const later = feed(dropped, [...waitFor(city.raiseAfterMs, 1), ...windowOf(WINDOW_FRAMES, 1, 1)]);
    expect(later.mode).toBe("low");
  });

  test(`[city:two-graphics-modes] given high after dropAfterMs, when ${String(AGREE_FRAMES - 1)} of 100 frames were too slow, then it stays high`, () => {
    const waited = feed(watchFrames("high", false), waitFor(city.dropAfterMs, 1));
    expect(feed(waited, windowOf(WINDOW_FRAMES - AGREE_FRAMES + 1, city.dropFrameMs, slowMs)).mode).toBe("high");
  });

  test("[city:two-graphics-modes] given a mode the player fixed, when every frame is slow, then it never moves", () => {
    const frames = [...waitFor(city.dropAfterMs, slowMs), ...windowOf(0, 1, slowMs)];
    expect(feed(watchFrames("high", true), frames).mode).toBe("high");
  });
});

describe("the table", () => {
  test("[city:two-graphics-modes] given each mode, when its settings are read, then pixel ratio, shadows, crowd, fog, atmosphere, antialiasing and mesh follow the table", () => {
    const low = modeSettings("low", desktop, city);
    const high = modeSettings("high", desktop, city);
    expect(low).toMatchObject({ pixelRatio: 1, shadows: false, crowd: city.crowdLow, atmosphere: false, antialias: false, mesh: "coarse" });
    expect(high).toMatchObject({ pixelRatio: city.maxPixelRatio, shadows: true, crowd: city.crowdHigh, atmosphere: true, antialias: true, mesh: "fine" });
    expect(low.fog.far).toBeLessThan(high.fog.far);
    expect(modeSettings("high", { ...desktop, pixelRatio: 1 }, city).pixelRatio).toBe(1);
  });
});

describe("what counts as a frame", () => {
  const slowMs = city.dropFrameMs + 1;
  /** The watch after each of `frames` in turn, each drawn as `frame` says. */
  function judge(watch: FrameWatch, frames: number[], frame: SceneFrame = "drawn"): FrameWatch {
    return frames.reduce((current, ms) => judgeFrame(current, ms, frame, city), watch);
  }

  test(`[city:two-graphics-modes] given high in a place, when a world just built draws its first ${String(SETTLE_FRAMES)} frames slowly while its shaders compile and its textures go up, then none of them is judged and the time in the place starts after them; the frame after them is judged`, () => {
    const fresh = judgeFrame(watchFrames("high", false), 1200, "fresh", city);
    const settling = judge(fresh, Array.from({ length: SETTLE_FRAMES - 1 }, () => 1200));
    expect(settling).toMatchObject({ mode: "high", elapsedMs: 0, frames: [] });
    const judged = judgeFrame(settling, slowMs, "drawn", city);
    expect(judged).toMatchObject({ elapsedMs: slowMs, frames: [slowMs] });
  });

  test("[city:two-graphics-modes] given high in a place, when the frame after a pause spans a minute away (a hidden tab, or the city behind the map), then it is not judged: it adds no time in the place and no slow frame", () => {
    const waited = judge(watchFrames("high", false), [16, 16]);
    const back = judgeFrame(waited, 60_000, "paused", city);
    expect(back).toMatchObject({ elapsedMs: 32, frames: [16, 16] });
    expect(judgeFrame(back, 17, "drawn", city).frames).toEqual([16, 16, 17]);
  });

  test("[city:two-graphics-modes] given high, when frames are drawn while the place is built anew, then none is judged", () => {
    const watch = judge(watchFrames("high", false), Array.from({ length: WINDOW_FRAMES * 2 }, () => 1000), "building");
    expect(watch).toMatchObject({ mode: "high", elapsedMs: 0, frames: [] });
  });

  test("[city:two-graphics-modes] given high and a pause of a minute, when the frames after it are slow, then it still drops only once dropAfterMs of judged frames have passed", () => {
    const back = judgeFrame(watchFrames("high", false), 60_000, "paused", city);
    const short = judge(back, Array.from({ length: WINDOW_FRAMES }, () => slowMs));
    expect(short.elapsedMs).toBeLessThan(city.dropAfterMs);
    expect(short.mode).toBe("high");
    expect(judge(short, waitFor(city.dropAfterMs, slowMs)).mode).toBe("low");
  });

  test(`[city:two-graphics-modes] given high and a world just built on a phone too slow for it, when its frames stay slow past the first ${String(SETTLE_FRAMES)}, then it drops to low once dropAfterMs of them have passed`, () => {
    const fresh = judge(judgeFrame(watchFrames("high", false), 2000, "fresh", city), Array.from({ length: SETTLE_FRAMES - 1 }, () => 2000));
    const dropped = judge(fresh, waitFor(Math.max(city.dropAfterMs, WINDOW_FRAMES * slowMs), slowMs));
    expect(dropped).toMatchObject({ mode: "low", fixed: true });
  });

  test("[city:two-graphics-modes] given low after a pause, when the frame after it spans the time away, then it cannot raise the mode early either", () => {
    const back = judgeFrame(watchFrames("low", false), 60_000, "paused", city);
    const fast = judge(back, Array.from({ length: WINDOW_FRAMES }, () => 1));
    expect(fast.mode).toBe("low");
  });
});
