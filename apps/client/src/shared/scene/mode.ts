// The two graphics modes and how the city moves between them (city.md R-CITY-019). Pure: the scene
// feeds in each frame's time and the time spent in the place, and reads back the mode and its table.
import type { Tuning } from "@japacity/sim";
import { GRAPHICS_KEY } from "../kept/storage";

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
  /** The device's memory in gigabytes where the browser says (Chrome's `deviceMemory`, capped at 8); null where it does not (Safari). */
  memory?: number | null;
}

/** How much memory a phone needs to start in high; below it, or with a coarse screen, a phone starts in low and rises when its frames allow. */
const PHONE_HIGH_MEMORY_GB = 4;

/**
 * A desktop (a fine pointer and a wide window) starts in high. A phone with a sharp screen and enough memory, or a memory the
 * browser keeps to itself, starts in high too and drops if its frames are slow (R-CITY-019: the rise
 * from low read as a jump in quality a moment into the first place); a coarse or small phone starts in low and rises.
 */
export function startingMode(device: Device, city: CityTuning, choice: ModeChoice = "auto"): Mode {
  if (choice !== "auto") return choice;
  if (device.finePointer && device.width >= city.desktopMinWidth) return "high";
  const memory = device.memory ?? null;
  return device.pixelRatio >= 2 && (memory === null || memory >= PHONE_HIGH_MEMORY_GB) ? "high" : "low";
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

function countAtMost(frames: readonly number[], limitMs: number): number {
  return frames.filter((frame) => frame <= limitMs).length;
}

/** True when a full window has at least AGREE_FRAMES frames at most `raiseFrameMs`. */
function fastEnough(frames: readonly number[], city: CityTuning): boolean {
  return frames.length >= WINDOW_FRAMES && countAtMost(frames, city.raiseFrameMs) >= AGREE_FRAMES;
}

/** True when a full window has at least AGREE_FRAMES frames over `dropFrameMs`. */
function tooSlow(frames: readonly number[], city: CityTuning): boolean {
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
  // Atmosphere is haze only: a rim light would be a third light against R-ASSET-006, and rain has no rule for when it falls.
  atmosphere: boolean;
  /**
   * How far the fog and the sky lean from the sky's colour toward the ground's, from 0 to 1. The
   * near fog of the low mode stands between the two, apart from the sky, so a roof fading into it keeps its edge.
   */
  haze: { fog: number; sky: number };
  antialias: boolean;
  /** Fine or coarse sheets and water: the dial that costs, not the motion. */
  mesh: "fine" | "coarse";
}

const FOG = { near: { near: 18, far: 45 }, far: { near: 40, far: 110 } } as const;
const HAZE = { near: { fog: 0.5, sky: 0 }, far: { fog: 0.18, sky: 0.18 } } as const;

export function modeSettings(mode: Mode, device: Device, city: CityTuning): ModeSettings {
  switch (mode) {
    case "low":
      return { pixelRatio: 1, shadows: false, crowd: city.crowdLow, fog: FOG.near, atmosphere: false, haze: HAZE.near, antialias: false, mesh: "coarse" };
    case "high":
      return { pixelRatio: Math.min(device.pixelRatio, city.maxPixelRatio), shadows: true, crowd: city.crowdHigh, fog: FOG.far, atmosphere: true, haze: HAZE.far, antialias: true, mesh: "fine" };
    default: {
      const never: never = mode;
      throw new Error(`Unknown mode: ${String(never)}`);
    }
  }
}

/** The player's choice on this device, or auto when none is kept or storage is shut. */
export function readChoice(storage: Pick<Storage, "getItem"> | null): ModeChoice {
  try {
    const kept = storage?.getItem(GRAPHICS_KEY) ?? null;
    return kept === "low" || kept === "high" ? kept : "auto";
  } catch {
    return "auto";
  }
}

export function keepChoice(storage: Pick<Storage, "setItem"> | null, choice: ModeChoice): void {
  try {
    storage?.setItem(GRAPHICS_KEY, choice);
  } catch {
    // A private window may refuse storage; the choice then lasts the session only.
  }
}
