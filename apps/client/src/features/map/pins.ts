// What the map shows and what a ride costs (docs/rules/world.md R-WORLD-015 to 017), as plain
// functions of the view, the kept list and content, so the screen only draws them.
import { content } from "@japacity/content";

import type { Pin, PinState, RideChoice } from "../../shared/world/contract";
import { mapWords, RIDES, WAYS } from "./map.words";
import type { Position } from "./layout";

/** A pin as the city hands it: the contract's, with the line optional until the city gives one. */
export type MapPin = Omit<Pin, "line"> & { line?: string };

/** A place as the map reads it from content. */
export interface MapPlace {
  id: string;
  position: Position | null;
  stages: readonly string[];
}

export interface PinsInput {
  /** The places the character can be in now (the city's `enterable`). */
  places: readonly MapPlace[];
  /** The place on screen. */
  here: string;
  /** The home of the country shown, or null. */
  home: string | null;
  /** Where the home stands when content gives it no position (a made-up street). */
  homeSpot: Position;
  /** The places the player has been to, as the city keeps them. */
  been: readonly string[];
  /** The places with a published model, or null while that is not known. */
  built: ReadonlySet<string> | null;
  /** The places the player may go to now; the rest of the built ones show as not yet. All when absent. */
  open?: ReadonlySet<string>;
  name: (id: string) => string;
}

/**
 * The pins of the map: only built places (and the home), each here, home, been, can go or not yet.
 * Until the published models are known every place with a position stands, as the city's list did.
 */
export function mapPins({ places, here, home, homeSpot, been, built, open, name }: PinsInput): MapPin[] {
  return places
    .filter((place) => place.id === home || (place.position !== null && (built === null || built.has(place.id))))
    .map((place) => {
      const state: PinState =
        place.id === here ? "here" : place.id === home ? "home" : open !== undefined && !open.has(place.id) ? "not" : been.includes(place.id) ? "been" : "can";
      return { id: place.id, name: name(place.id), state, position: place.position ?? homeSpot, things: place.stages.length };
    });
}

/** Metres in a straight line between two positions. */
export function metresBetween(from: Position, to: Position): number {
  const cos = Math.cos((from.latE3 / 1000) * (Math.PI / 180));
  return Math.hypot((to.lonE3 - from.lonE3) * 111.32 * cos, (to.latE3 - from.latE3) * 111.32);
}

/** Minutes by danfo between two places, as the city's list reckoned them: a base wait and a Lagos pace. */
export function danfoMinutes(from: Position, to: Position): number {
  return 8 + Math.round(metresBetween(from, to) / 120);
}

const KOBO_PER_NAIRA = 100;
/** Fares are asked in fifties of naira. */
const FARE_STEP = 50;

/**
 * The three ways to a place, each with its fare in kobo and its minutes. Fares are in naira while
 * tuning says so (`place.fareFromNaira`). No place entry carries a fare of its own, so the map's
 * table prices every ride (see `RIDES`).
 */
export function rideChoices(from: Position, to: Position): RideChoice[] {
  const km = metresBetween(from, to) / 1000;
  const minutes = danfoMinutes(from, to);
  // `fareFromNaira` is read as "the table's figures are whole naira"; when it is off they are
  // taken as kobo already. Nothing says what it means for a ride inside a city, so it is still open.
  const naira = content.tuning.place.fareFromNaira;
  return WAYS.map((id) => {
    const way = RIDES[id];
    const fare = Math.ceil((way.board + way.perKm * km) / FARE_STEP) * FARE_STEP * (naira ? KOBO_PER_NAIRA : 1);
    return { id, label: mapWords(`map.way.${id}`), fare, minutes: Math.max(3, Math.round((minutes * way.paceBp) / 10000)) };
  });
}
