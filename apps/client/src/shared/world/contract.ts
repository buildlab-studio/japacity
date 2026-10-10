// The world-first contract (docs/rules/world.md): what the shell, the scene, the map, the phone and
// the places hand each other. Each feature implements its side against these types and nothing else,
// so the pieces can be built apart and composed in App.tsx. Plain data only; no three.js here.
import type { ReactNode } from "react";

/** A spot in a place: x, z in metres, and the turn about +Y in radians. */
export type Spot = [number, number, number];

/** What a tap on a thing does (R-WORLD-005). */
export type ActKind =
  /** Happens at once with no sheet: sit, turn on, look. */
  | "plain"
  /** Opens the sheet of the entry it stages: an activity, an offer, a set piece. */
  | "sheet"
  /** Opens the ride sheet (R-WORLD-017). */
  | "ride"
  /** Cuts into the building's room (R-WORLD-013). */
  | "enter"
  /** Cuts back out of the room. */
  | "out"
  /** Ends the month from the bed at home: the same as the band's End month (R-WORLD-025). */
  | "end"
  /** Happens at once and fills a free slot of the month with the entry it stages, no sheet: rest on the bed (R-WORLD-005). */
  | "do"
  /** Opens a card for a player command the world sends on its own: the school's deposit at the bank (R-ROUTE-008). */
  | "command";

export interface Act {
  /** The act's id within its thing: `sit`, `sleep`, `play-lotto`. */
  id: string;
  /** The words key of the act's label (city.words or content). */
  label: string;
  kind: ActKind;
  /** For `sheet`: the entry the act stages (`activity.play-lotto`, `offer.nepa-bill`). */
  stages?: string;
  /** For `sheet`: the choice inside the staged entry that the thing itself makes, as a board names its job: the kiosk's one ticket (R-WORLD-005). */
  param?: string;
  /** For `sheet`: more entries listed on the same sheet, since a thing offers at most two acts and a third goes on a sheet (R-WORLD-005). */
  more?: string[];
  /** For `plain`: the entries whose acts stand in its place; it shows only while none of them can open (the agent at an empty desk). */
  unless?: string[];
  /** For `command`: which command the card sends. */
  command?: "route/pay-deposit" | "route/depart" | "obligation/pay";
  /** The pose the character takes on the thing once the act lands: sitting on it, lying on it (R-WORLD-005). */
  pose?: "sit" | "lie";
  /** Where the character is placed for the pose: on the seat or the bed, `[x, z, facing]` in the place's metres. */
  seat?: [number, number, number];
  /** For `lie`: the height of the top the character lies on (the mattress, the couch's cushions), in metres, so the body lies on it, not in it. */
  top?: number;
  /** Set by the shell: the act is already in this month's plan and planning it again does nothing, so its button says Planned and is shut. */
  planned?: boolean;
}

/**
 * A thing in a place file (`stage.things`): a model copy the player can tap, its label and its acts.
 * `file` is the model's path as in `stage.models`; `copy` picks which copy when there are several.
 */
export interface Thing {
  id: string;
  file: string;
  copy: number;
  /** The words key of the name shown over the thing. */
  label: string;
  /** Where the character walks to for it, or the copy's spot when absent. */
  at?: [number, number];
  acts: Act[];
}

/** The place's camera (R-WORLD-009): what the whole view looks at and how it may move. */
export interface Shot {
  centre: [number, number, number];
  /** Metres from the centre for the whole view and the close view. */
  far: number;
  near: number;
  /** Pitch above the ground in degrees for the whole view and the close view. */
  farPitch: number;
  nearPitch: number;
  /** How far the view may turn either side of straight, in degrees. */
  turn: number;
  /** The facing of the whole view, in degrees; 0 looks along +Z. */
  yaw?: number;
  /** Metres across that the whole view must show, whatever the screen's shape. */
  width?: number;
}

/** What the scene reports to the shell after a tap (R-WORLD-005). */
export type Picked =
  | { kind: "thing"; thing: Thing }
  | { kind: "act"; thing: Thing; act: Act }
  | { kind: "person"; slot: number }
  | { kind: "own" };

/** The nudge (R-WORLD-003): one words key with its params, or null. */
export interface Nudge {
  key: string;
  params?: Record<string, string | number>;
}

/** A sheet's content (R-WORLD-006): the shell renders it in the form it names. */
export interface Ask {
  form: "card" | "slip";
  /** An icon name from the shared icon set. */
  icon: string;
  /** Who is asking, their line, the title, all words keys or plain words from content. */
  who: string;
  title: string;
  line: string;
  /** The cost in the wallet's smallest unit and currency, or null when free. */
  cost: { amount: number; currency: string } | null;
  /** The main button's words key. */
  button: string;
  /** What the main button does. */
  act: () => void;
  /** The way to say not now. */
  dismiss: () => void;
  /** For a slip: a reference line printed small at the top right. */
  reference?: string;
  /** For a slip: lines printed on the paper, each a label and its value, in place of the one big figure: a waybill's from, to, contents and charge. `strong` prints the line bold. */
  rows?: { label: string; value: string; strong?: boolean }[];
  /** "now" when the act happens at once (a ride, the deposit, the plane); the default counts when the month ends. */
  when?: "now" | "month";
  /** A reason the act cannot happen yet, in words; the main button is shut and says it (R-WORLD-006). */
  blocked?: string;
  /** A second line for the main button in place of what is left after, when the cost does not come from the pockets. */
  note?: string;
}

/** A pin on the map (R-WORLD-015). */
export type PinState = "here" | "home" | "been" | "can" | "not";

export interface Pin {
  id: string;
  name: string;
  state: PinState;
  position: { latE3: number; lonE3: number };
  /** A line about the place, a words key. */
  line: string;
  /** Things to do there, for the card. */
  things: number;
}

export interface CountryChoice {
  id: string;
  name: string;
  /** Why it cannot be opened, a words key, or null when it can. */
  locked: string | null;
}

/** A way to travel (R-WORLD-017), with its fare in the wallet's smallest unit and the minutes. */
export interface RideChoice {
  id: "danfo" | "keke" | "okada" | "walk";
  label: string;
  fare: number;
  minutes: number;
  /** Why the way cannot be taken: too far on foot (R-WORLD-017). */
  shut?: "far";
}

/** An app on the phone (R-WORLD-018). */
export interface PhoneApp {
  id: string;
  /** The app's name, a words key. */
  name: string;
  /** The icon name from the shared icon set. */
  icon: string;
  /** The tile's colour role token, as `--app-<id>` in the theme. */
  tint: string;
  screen: ReactNode;
  /** A dot on the tile: something the player has not seen. */
  waiting: boolean;
}

/** Where the player is, for the shell's band and the home point (R-WORLD-014). */
export interface Here {
  place: string;
  inside: boolean;
}

/** The theme (R-WORLD-021). */
export type Theme = "adire" | "danfo";
export const THEME_KEY = "japacity.theme";
