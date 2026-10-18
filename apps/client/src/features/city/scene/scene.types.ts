// What the city's screen hands the 3D scene and hears back. Kept free of three.js so the screen can
// be in the first chunk and the scene loaded only where WebGL exists.
import type { WorldClock } from "@japacity/sim";

import type { Act, Picked as WorldPicked, Shot, Thing } from "../../../shared/world/contract";
import type { Shown } from "../../../shared/scene/crowd";
import type { ModeSettings } from "../../../shared/scene/mode";
import type { PlaceFile } from "../../../shared/scene/placeFile";
import type { Walker } from "../../../shared/scene/walk";

/** What the screen makes of a tap: a person, a shopfront, a thing chosen, or what an act of a thing does. A tap on the player's own figure makes nothing (world:things-are-tappable-models). */
export type Picked =
  | { kind: "person"; slot: number }
  | { kind: "model"; file: string; signs: string[] }
  | { kind: "thing"; thing: Thing }
  | { kind: "action"; activity: string; more?: string[]; label?: string; param?: string }
  | { kind: "command"; command: "route/pay-deposit" | "route/depart" | "obligation/pay" | "people/court" | "return/home"; with?: string }
  | { kind: "enter"; place: string }
  | { kind: "inside" }
  | { kind: "out" };

/** What the scene reports after a tap: the contract's pick (world:things-are-tappable-models), or a shopfront with its signs. */
export type ScenePick = WorldPicked | { kind: "model"; file: string; signs: string[] };

export interface SceneProps {
  /** True while the opening words stand over the world: the thing labels hide under them (world:world-fills-the-screen). */
  labelsHidden?: boolean;
  place: string;
  file: PlaceFile;
  people: readonly Shown[];
  /** The player's own character's file. */
  own: string;
  settings: ModeSettings;
  /** The city is on screen and takes taps; under the map or another screen it only idles. */
  looking: boolean;
  /** Sign words by text key (city:place-words-are-text-keys). */
  text: (key: string) => string | undefined;
  onProgress: (loaded: number, total: number) => void;
  onFailed: (why: string) => void;
  onPick: (picked: ScenePick) => void;
  onFrame: (frameMs: number) => void;
  /** The world mode: the raised camera of world:camera-always-raised, the place's things and their acts. */
  overview?: boolean;
  /** The world mode: the street camera, the hold-to-plan view, routed walks and strolling people (tuning.city.roam). */
  roam?: boolean;
  /** The world mode: the things the player can tap here, each with the acts the view allows now (world:things-are-tappable-models). */
  things?: readonly Thing[];
  /** The world mode: a state its name carries by thing id, while an act of it carries on in the plan ("Ongoing"; world:things-are-tappable-models). */
  marks?: Readonly<Record<string, string>>;
  /** The world mode: the things whose name shows over their mark: a person holding an ask or the nudge's target (world:things-are-tappable-models). */
  named?: readonly string[];
  /** The world mode: the thing the nudge points at, whose mark pulses gently (world:nudge-says-one-thing). */
  nudged?: string | null;
  /** The world mode: true for the two seconds every name shows on a place's first entry in a life, then fades (world:things-are-tappable-models). */
  teaching?: boolean;
  /**
   * The world mode: an act chosen on a button of the thing's fan, each tap a new `at`: the character walks to the thing and
   * the act follows on arrival, a second tap ending the walk at once (world:nothing-roams).
   */
  actOn?: { thing: Thing; act: Act; at: number } | null;
  /** The world mode: a tap on open ground, which puts away the thing's fan. */
  onClear?: () => void;
  /** The world mode: true while the view is close on the character, false while it shows the whole place. */
  zoomed?: boolean;
  /** The world mode: the pinch came to rest close (true) or on the whole place (false). */
  onZoomed?: (zoomed: boolean) => void;
  /**
   * The world mode, a wide home: the quarter, 0 to 3, the view looks from, turned from the file's
   * facing; a new quarter eases the view round to it the short way. The home opens on it, so a reload shows the house as
   * it was left.
   */
  turn?: number;
  /** The world mode, a wide home: a finger's turn came to rest on this quarter, 0 to 3. */
  onTurned?: (quarter: number) => void;
  /** The world mode: the act done at once that landed last and when, so its answer plays where it was done (world:things-are-tappable-models). */
  acted?: { activity: string; at: number } | null;
  /** The world's clock the last reply carried, or null before one (clock:game-day-on-real-time); the scene carries it on by the device's clock. */
  worldClock?: WorldClock | null;
  /**
   * The world mode: the thing the character sleeps on while the bed's timed sleep runs, or null (world:sleep-ends-the-month). The figure
   * lies on it as the nap does, a small sleep mark floats over it, and when it goes back to null the figure gets up.
   */
  asleep?: string | null;
  /**
   * The world mode, in a home of your own with things owned standing in it: buy mode. A
   * hold on a thing you own lifts it, a drag sets it down where it fits, a tap while it is lifted turns it a quarter, a
   * tap anywhere else sets it down. `onSet` keeps where it was set down; `onLift` and `onMisfit` sound the lift and the
   * shake back.
   */
  arrange?: { onSet: (thing: string, spot: [number, number, number]) => void; onLift?: () => void; onMisfit?: () => void } | null;
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
  /** The moving sheets drawn (world:place-is-one-screen). */
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
  /** A wide home: the room the view eases in on, and a way to ease in on a room or, with null, out to the whole house. */
  room?: string | null;
  ease?: (room: string | null) => void;
  /** A wide home: degrees the view is turned from the file's facing, the tilt toward the view from above, and the quarter whose wall pair stands full. */
  turn?: number;
  tilt?: number;
  walls?: number | null;
  /** The world mode: where a thing stands on screen, in CSS pixels, or null when off screen. */
  screenOfThing?: (id: string) => { x: number; y: number } | null;
  /** The sun's shadow: its bias, its normal bias and how far either side of the place's centre it reaches (world:faces-never-share-height). */
  shadow?: { bias: number; normalBias: number; reach: number };
  /** The world mode: whether the shot's width and every thing stand on screen in the view drawn now. */
  fits?: () => { width: boolean; offScreen: string[] };
}

declare global {
  interface Window {
    __city?: CityProbe;
  }
}
