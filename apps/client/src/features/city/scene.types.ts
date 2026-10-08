// What the city's screen hands the 3D scene and hears back. Kept free of three.js so the screen can
// be in the first chunk and the scene loaded only where WebGL exists.
import type { Shown } from "./crowd";
import type { ModeSettings } from "./mode";
import type { PlaceFile } from "./placeFile";
import type { Walker } from "./walk";

/** What a tap landed on, other than the ground. */
export type Picked = { kind: "person"; slot: number } | { kind: "own" } | { kind: "model"; file: string; signs: string[] } | { kind: "action"; activity: string } | { kind: "ride"; vehicle: string } | { kind: "enter"; place: string };

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
  /** The world mode: what a tapped model does here, by its file: an action it stages, a ride, a door into a place, or nothing. */
  actionOf?: (file: string) => Picked | null;
  /** The world mode: a model the player can step inside, by its file (rule 14): the camera drops to eye level at its door. */
  insideOf?: (file: string) => boolean;
  /** The world mode: the camera starts pulled back and raised, and comes down to the street at the first tap. */
  overview?: boolean;
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
  /** Where a model whose file ends with `suffix` stands on screen, for the browser test and the shooter. */
  screenOfModel: (suffix: string) => { x: number; y: number } | null;
  /** What the last tap landed on and the action it stages, for the browser test. */
  lastTap?: { picked: Picked | null; action: string | null };
  /** The world mode: true while the camera is inside a building. */
  inside?: boolean;
}

declare global {
  interface Window {
    __city?: CityProbe;
  }
}
