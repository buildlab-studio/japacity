// What the city's screen hands the 3D scene and hears back. Kept free of three.js so the screen can
// be in the first chunk and the scene loaded only where WebGL exists.
import type { Shown } from "./crowd";
import type { ModeSettings } from "./mode";
import type { PlaceFile } from "./placeFile";
import type { Walker } from "./walk";

/** What a tap landed on, other than the ground. */
export type Picked = { kind: "person"; slot: number } | { kind: "own" } | { kind: "model"; file: string; signs: string[] };

export interface SceneProps {
  place: string;
  file: PlaceFile;
  people: readonly Shown[];
  /** The player's own character's file. */
  own: string;
  settings: ModeSettings;
  /** The city is in front of the panels and takes taps; behind them it only idles. */
  looking: boolean;
  /** Sign words by text key (R-CITY-024). */
  text: (key: string) => string | undefined;
  onProgress: (loaded: number, total: number) => void;
  onFailed: (why: string) => void;
  onPick: (picked: Picked) => void;
  onFrame: (frameMs: number) => void;
}

/** Read by the browser test: what the last frame drew and where the character is. */
export interface CityProbe {
  place: string;
  ready: boolean;
  drawCalls: number;
  triangles: number;
  frames: number[];
  walker: Walker;
  people: number;
  /** Where a slot's person stands on screen, in CSS pixels, or null when off screen. */
  screenOf: (slot: number) => { x: number; y: number } | null;
}

declare global {
  interface Window {
    __city?: CityProbe;
  }
}
