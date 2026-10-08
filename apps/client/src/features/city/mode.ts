// The two graphics modes and how the city moves between them (city.md R-CITY-019). Pure: the scene
// feeds in each frame's time and the time spent in the place, and reads back the mode and its table.
import type { Tuning } from "@japacity/sim";

export type Mode = "low" | "high";
/** What the player chose in settings: the game's own judgement, or a mode fixed for this device. */
export type ModeChoice = "auto" | Mode;
export type CityTuning = Tuning["city"];

/** Frames judged at a time, and how many of them must agree (R-CITY-019: 95 in 100). */
export const WINDOW_FRAMES = 100;
export const AGREE_FRAMES = 95;

export interface Device {
  /** A mouse or trackpad, from `(pointer: fine)`. */
  finePointer: boolean;
  /** The window's width in CSS pixels. */
  width: number;
  /** The device's own pixel ratio. */
  pixelRatio: number;
}

/** A phone starts in low; a desktop (a fine pointer and a wide window) starts in high. */
export function startingMode(device: Device, city: CityTuning, choice: ModeChoice = "auto"): Mode {
  if (choice !== "auto") return choice;
  return device.finePointer && device.width >= city.desktopMinWidth ? "high" : "low";
}

export interface FrameWatch {
  mode: Mode;
  /** Milliseconds since the place was entered or the mode last changed. */
  elapsedMs: number;
  /** The last frames' times in milliseconds, oldest first, at most WINDOW_FRAMES. */
  frames: number[];
  /** True once the mode dropped: it stays low for the session. Also true when the player fixed the mode. */
  fixed: boolean;
}

export function watchFrames(mode: Mode, fixed: boolean): FrameWatch {
  return { mode, elapsedMs: 0, frames: [], fixed };
}

/** A fresh count on entering a place, keeping the mode and whether it is fixed. */
export function enterPlace(watch: FrameWatch): FrameWatch {
  return { ...watch, elapsedMs: 0, frames: [] };
}

export function countAtMost(frames: readonly number[], limitMs: number): number {
  return frames.filter((frame) => frame <= limitMs).length;
}

/** True when a full window has at least AGREE_FRAMES frames at most `raiseFrameMs`. */
export function fastEnough(frames: readonly number[], city: CityTuning): boolean {
  return frames.length >= WINDOW_FRAMES && countAtMost(frames, city.raiseFrameMs) >= AGREE_FRAMES;
}

/** True when a full window has at least AGREE_FRAMES frames over `dropFrameMs`. */
export function tooSlow(frames: readonly number[], city: CityTuning): boolean {
  return frames.length >= WINDOW_FRAMES && frames.length - countAtMost(frames, city.dropFrameMs) >= AGREE_FRAMES;
}

/**
 * One frame seen. Low rises to high once it has been in the place `raiseAfterMs` and the last 100
 * frames were fast enough; high drops to low once it has run `dropAfterMs` and the last 100 were
 * too slow, and then stays low. A mode the player fixed never moves.
 */
export function observeFrame(watch: FrameWatch, frameMs: number, city: CityTuning): FrameWatch {
  if (watch.fixed) return watch;
  const frames = [...watch.frames, frameMs].slice(-WINDOW_FRAMES);
  const elapsedMs = watch.elapsedMs + frameMs;
  if (watch.mode === "low" && elapsedMs >= city.raiseAfterMs && fastEnough(frames, city)) return { mode: "high", elapsedMs: 0, frames: [], fixed: false };
  if (watch.mode === "high" && elapsedMs >= city.dropAfterMs && tooSlow(frames, city)) return { mode: "low", elapsedMs: 0, frames: [], fixed: true };
  return { ...watch, frames, elapsedMs };
}

/** How the scene is drawn in a mode: the table of R-CITY-019. */
export interface ModeSettings {
  pixelRatio: number;
  shadows: boolean;
  crowd: number;
  /** Where the fog starts and is full, in metres. */
  fog: { near: number; far: number };
  atmosphere: boolean;
  antialias: boolean;
  /** Fine or coarse sheets and water: the dial that costs, not the motion (the decision). */
  mesh: "fine" | "coarse";
}

export const FOG = { near: { near: 18, far: 45 }, far: { near: 40, far: 110 } } as const;

export function modeSettings(mode: Mode, device: Device, city: CityTuning): ModeSettings {
  switch (mode) {
    case "low":
      return { pixelRatio: 1, shadows: false, crowd: city.crowdLow, fog: FOG.near, atmosphere: false, antialias: false, mesh: "coarse" };
    case "high":
      return { pixelRatio: Math.min(device.pixelRatio, city.maxPixelRatio), shadows: true, crowd: city.crowdHigh, fog: FOG.far, atmosphere: true, antialias: true, mesh: "fine" };
    default: {
      const never: never = mode;
      throw new Error(`Unknown mode: ${String(never)}`);
    }
  }
}

const CHOICE_KEY = "japacity.city.graphics";

/** The player's choice on this device, or auto when none is kept or storage is shut. */
export function readChoice(storage: Pick<Storage, "getItem"> | null): ModeChoice {
  try {
    const kept = storage?.getItem(CHOICE_KEY) ?? null;
    return kept === "low" || kept === "high" ? kept : "auto";
  } catch {
    return "auto";
  }
}

export function keepChoice(storage: Pick<Storage, "setItem"> | null, choice: ModeChoice): void {
  try {
    storage?.setItem(CHOICE_KEY, choice);
  } catch {
    // A private window may refuse storage; the choice then lasts the session only.
  }
}
