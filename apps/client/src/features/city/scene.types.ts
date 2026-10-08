// What the city's screen hands the 3D scene and hears back. Kept free of three.js so the screen can
// be in the first chunk and the scene loaded only where WebGL exists.
import type { Picked as WorldPicked, Shot, Thing } from "../../shared/world/contract";
import type { Shown } from "./crowd";
import type { ModeSettings } from "./mode";
import type { PlaceFile } from "./placeFile";
import type { Walker } from "./walk";

/** What the screen makes of a tap: a person, the player, a shopfront, a thing chosen, or what an act of a thing does. */
export type Picked =
  | { kind: "person"; slot: number }
  | { kind: "own" }
  | { kind: "model"; file: string; signs: string[] }
  | { kind: "thing"; thing: Thing }
  | { kind: "action"; activity: string }
  | { kind: "ride"; vehicle: string }
  | { kind: "enter"; place: string }
  | { kind: "inside" }
  | { kind: "out" };

/** What the scene reports after a tap: the contract's pick (world.md R-WORLD-005), or a shopfront with its signs. */
export type ScenePick = WorldPicked | { kind: "model"; file: string; signs: string[] };

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
  onPick: (picked: ScenePick) => void;
  onFrame: (frameMs: number) => void;
  /** The world mode: the raised camera of world.md R-WORLD-009, the place's things and their acts. */
  overview?: boolean;
  /** The world mode: the street camera, the hold-to-plan view, routed walks and strolling people (tuning.city.roam). */
  roam?: boolean;
  /** The world mode: the things the player can tap here, each with the acts the view allows now (R-WORLD-005). */
  things?: readonly Thing[];
  /** The world mode: the thing whose name and acts float over it, or null. */
  chosen?: Thing | null;
  /** The world mode: a tap on open ground, which puts away the thing's acts. */
  onClear?: () => void;
  /** The world mode: true while the view is close on the character, false while it shows the whole place. */
  zoomed?: boolean;
  /** The world mode: the pinch came to rest close (true) or on the whole place (false). */
  onZoomed?: (zoomed: boolean) => void;
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
  /** The moving sheets drawn (world.md R-WORLD-011). */
  sheets: number;
  /** Where a slot's person stands on screen, in CSS pixels, or null when off screen. */
  screenOf: (slot: number) => { x: number; y: number } | null;
  /** Where a model whose file ends with `suffix` stands on screen, for the browser test and the shooter. */
  screenOfModel: (suffix: string) => { x: number; y: number } | null;
  /** What the last tap landed on and the action it stages, for the browser test. */
  lastTap?: { picked: ScenePick | null; action: string | null };
  /** The world mode: the shot, and how far toward the whole place the view stands now and where it is going. */
  shot?: Shot;
  zoom?: number;
  zoomTo?: number;
  /** The world mode: where a thing stands on screen, in CSS pixels, or null when off screen. */
  screenOfThing?: (id: string) => { x: number; y: number } | null;
  /** The sun's shadow: its bias, its normal bias and how far either side of the place's centre it reaches (R-WORLD-012). */
  shadow?: { bias: number; normalBias: number; reach: number };
  /** The world mode: whether the shot's width and every thing stand on screen in the view drawn now. */
  fits?: () => { width: boolean; offScreen: string[] };
}

declare global {
  interface Window {
    __city?: CityProbe;
  }
}
