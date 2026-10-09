// What the map shows and what a ride costs (docs/rules/world.md R-WORLD-015 to 017), as plain
// functions of the view, the kept list and content, so the screen only draws them.
import { content } from "@japacity/content";

import type { Pin, PinState, RideChoice } from "../../shared/world/contract";
import { mapWords, WAYS } from "./map.words";
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

/** A ride abroad takes about this long over the wait; the city's distances are not drawn yet. */
const ABROAD_MINUTES = 25;

/** Metres in a straight line between two positions. */
export function metresBetween(from: Position, to: Position): number {
  const cos = Math.cos((from.latE3 / 1000) * (Math.PI / 180));
  return Math.hypot((to.lonE3 - from.lonE3) * 111.32 * cos, (to.latE3 - from.latE3) * 111.32);
}

/**
 * The three ways to a place, each with its fare in kobo and its minutes. The fare is the way's
 * flat fare in tuning, the same the simulation takes for `place/ride` (R-PLACE-010, decision 0011);
 * the minutes are the wait plus the straight-line distance at the way's pace.
 */
export function rideChoices(from: Position, to: Position, country: string | null = null): RideChoice[] {
  const { fareKobo, metresPerMinute, waitMinutes } = content.tuning.city.ride;
  // Abroad there is one way, named for the country, at no fare until the tuning carries fares in that country's money (decision 0011).
  if (country !== null) return [{ id: "danfo", label: mapWords(`map.way.abroad.${country}`), fare: 0, minutes: waitMinutes + ABROAD_MINUTES }];
  const metres = metresBetween(from, to);
  return WAYS.map((id) => ({ id, label: mapWords(`map.way.${id}`), fare: fareKobo[id], minutes: waitMinutes + Math.max(1, Math.round(metres / metresPerMinute[id])) }));
}
