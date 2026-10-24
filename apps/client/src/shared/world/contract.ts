// The world-first contract (docs/rules/world.md): what the shell, the scene, the map, the phone and
// the places hand each other. Each feature implements its side against these types and nothing else,
// so the pieces can be built apart and composed in App.tsx. Plain data only; no three.js here.
import type { DayPart } from "@japacity/sim";
import type { ReactNode } from "react";

/** What a tap on a thing does (world:things-are-tappable-models). */
type ActKind =
  /** Happens at once with no sheet: sit, turn on, look. */
  | "plain"
  /** Opens the sheet of the entry it stages: an activity, an offer, a set piece. */
  | "sheet"
  /** Opens the ride sheet (world:ride-sheet-shows-fares). */
  | "ride"
  /** Cuts into the building's room (world:entering-is-a-cut). */
  | "enter"
  /** Cuts back out of the room. */
  | "out"
  /** The bed's Sleep: a timed sleep that ends the month when it runs out, through the store's `endMonth` (world:sleep-ends-the-month). */
  | "end"
  /** The entry it stages, with no sheet: an act done at once is sent, a month-act joins the plan (world:things-are-tappable-models). */
  | "do"
  /** Opens a card for a player command the world sends on its own: the school's deposit at the bank (route:deposit-secures-school). */
  | "command"
  /** Opens the phone on one of its apps: the papers box opens Papers (world:phone-holds-what-phones-hold). */
  | "app";

export interface Act {
  /** The act's id within its thing: `sit`, `sleep`, `play-lotto`. */
  id: string;
  /** The words key of the act's label (city.words or content). */
  label: string;
  kind: ActKind;
  /** For `sheet`: the entry the act stages (`activity.play-lotto`, `offer.nepa-bill`). */
  stages?: string;
  /** For `sheet`: the choice inside the staged entry that the thing itself makes, as a board names its job: the kiosk's one ticket (world:things-are-tappable-models). */
  param?: string;
  /** For `sheet`: more entries listed on the same sheet, since a thing offers at most two acts and a third goes on a sheet (world:things-are-tappable-models). */
  more?: string[];
  /** For `plain`: the entries whose acts stand in its place; it shows only while none of them can open (the agent at an empty desk). */
  unless?: string[];
  /**
   * For `sheet`: the act shown in its place while none of its entries can open, so a thing still offers two acts at most:
   * the bed's Lie down while no nap can be had (at night, spent, abroad; world:things-are-tappable-models, world:sleep-ends-the-month).
   */
  otherwise?: Act;
  /** For `app`: the phone app it opens, by its id on the phone (`papers`). */
  app?: string;
  /** For `command`: which command the card sends; `return/home` is the bag's Go home in the room abroad (return.md). */
  command?: "route/pay-deposit" | "route/depart" | "obligation/pay" | "people/court" | "return/home";
  /** For `command` `people/court`: the computer partner the card courts, set by the city from who stands at the thing (world:nobody-picked-from-list). */
  with?: string;
  /** The pose the character takes on the thing once the act lands: sitting on it, lying on it (world:things-are-tappable-models). */
  pose?: "sit" | "lie";
  /** Where the character is placed for the pose: on the seat or the bed, `[x, z, facing]` in the place's metres. */
  seat?: [number, number, number];
  /** For `lie`: the height of the top the character lies on (the mattress, the couch's cushions), in metres, so the body lies on it, not in it. */
  top?: number;
  /** Set by the shell: the act is already in this month's plan and planning it again does nothing, so its button says Planned and is shut. */
  planned?: boolean;
  /** activity:spent-body-refuses-acts: the act takes effort and the body is spent: its chip says so where its button was. */
  spent?: boolean;
  /**
   * The parts of the world's day the act is open in (clock:game-day-on-real-time, world:things-are-tappable-models): the viewing centre from the
   * evening, the joint in the evening and at night. Open at every part when not given.
   */
  parts?: DayPart[];
  /** For `plain`: the words key of the line told in the corner, when it is not the label's `.done` (a shut thing's reason). */
  tells?: string;
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
  /** The quiet mark beside the name of a person the game plays: `computer` (person:computer-candidates-labelled, person:computer-mark-is-quiet). */
  mark?: "computer";
}

/** The place's camera (world:camera-always-raised): what the whole view looks at and how it may move. */
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
  /** The whole view's lens in degrees, when it is not the scene's own: a wide home is seen whole on a longer lens, so the people at its back stand as tall as those at its front (world:room-seen-down-its-length). */
  fov?: number;
}

/** What the scene reports to the shell after a tap (world:things-are-tappable-models). */
export type Picked =
  | { kind: "thing"; thing: Thing }
  | { kind: "act"; thing: Thing; act: Act }
  | { kind: "person"; slot: number }
  | { kind: "own" };

/** The nudge (world:nudge-says-one-thing): one words key with its params, or null. */
export interface Nudge {
  key: string;
  params?: Record<string, string | number>;
}

/** A sheet's content (world:one-action-one-sheet): the shell renders it in the form it names. */
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
  /** The month's free time the act takes, in words ("A morning", "A day"), for an act done at once (activity:now-acts-spend-half-days). */
  time?: string;
  /** What the act does, in words, on one line ("Fills you, lifts you"), from its effects (world:one-action-one-sheet). */
  does?: string;
  /** An act with a price: the main button says the act and its price ("Indomie and egg · ₦1,500"), world:one-action-one-sheet. */
  priced?: true;
  /** A reason the act cannot happen yet, in words; the main button is shut and says it (world:one-action-one-sheet). */
  blocked?: string;
  /** A second line for the main button in place of what is left after, when the cost does not come from the pockets. */
  note?: string;
  /** activity:spent-body-refuses-acts: the body is spent; these words stand where the main button was, and there is no button. */
  spent?: string;
  /** What the act means, a few words each, as chips under the line: the bag's Go home says what ends and what waits (return.md). */
  facts?: string[];
  /** False when the act ends the month's dues, so the button warns of none: the way home closes the bills abroad (return:return-reopens-home-charges). */
  dues?: false;
  /**
   * A second way, quiet under the main button, with its own line: the bag's returns service (place:returns-service-takes-you-home).
   * It costs what cannot be got back, so a tap asks once more and names it (world:costly-acts-confirmed): the safe choice is then
   * the main button, and `go` wears the warning colour apart from it.
   */
  other?: { button: string; line: string; sure: { line: string; keep: string; go: string }; act: () => void };
}

/** A pin on the map (world:map-is-painted-lagos). */
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

/** A way to travel (world:ride-sheet-shows-fares), with its fare in the wallet's smallest unit and the minutes. */
export interface RideChoice {
  /** `drive`: the life's own car, offered while it stands at home. `bus`, `train` and `taxi`: the ways abroad (place:rides-between-city-places). */
  id: "danfo" | "keke" | "okada" | "walk" | "drive" | "bus" | "train" | "taxi";
  label: string;
  /** In the smallest unit of the money the ride is paid in: naira at home, the country's money abroad. */
  fare: number;
  minutes: number;
  /**
   * Why the way cannot be taken (world:ride-sheet-shows-fares): too far on foot; `fare`, a walk home past the walking limit
   * while another way's fare is in hand.
   */
  shut?: "far" | "fare";
  /** A walk home past the walking limit while no other way's fare is in hand: open, played long and with no Skip (world:ride-sheet-shows-fares). */
  long?: true;
  /** The bus in a month the bus pass is bought: it asks nothing, and the sheet says so (place:country-pass-covers-ways). */
  passed?: true;
  /** The bus to or from a stop the employer's shuttle serves: it asks nothing in any month (place:employer-shuttle-rides-free). */
  shuttle?: true;
  /** What the fare's pill says where the ride asks nothing for the country's pass or its shuttle ("C$0, transit pass", "AED 0, site bus"). */
  pill?: string;
}

/** An app on the phone (world:phone-rises-over-scene). */
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
  /** A few words of what is there now, as a pill beside the app's name in its head ("5 open", "Rent in 3 months"); never days. */
  context?: string | null;
}
