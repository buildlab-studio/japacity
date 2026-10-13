// What the map shows and what a ride costs (docs/rules/world.md R-WORLD-015 to 017), as plain
// functions of the view, the kept list and content, so the screen only draws them.
import { content } from "@japacity/content";
import { rideFare } from "@japacity/sim";

import type { Pin, PinState, RideChoice } from "../../shared/world/contract";
import { mapWords, WAYS } from "./map.words";
import type { Position } from "./paper/fit";

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
/** A rented home is on the map only while it is lived in (home.md R-HOME-010); the family house keeps its place. */
export const RENTED_HOMES: ReadonlySet<string> = new Set(["place.compound-room", "place.hostel-room"]);

/** Whether a place may stand on the map at all: a rented room or the hostel only as the home lived in (city.md's rows under R-HOME-010, R-HOME-002). */
export function onMap(id: string, home: string | null): boolean {
  return !RENTED_HOMES.has(id) || id === home;
}

export function mapPins({ places, here, home, homeSpot, been, built, open, name }: PinsInput): MapPin[] {
  return places
    .filter((place) => place.id === home || (onMap(place.id, home) && place.position !== null && (built === null || built.has(place.id))))
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
 * The three ways to a place, each with its fare in kobo and its minutes. The fare is the simulation's own figure for
 * `place/ride` (R-PLACE-010 as amended 12 Oct 2026: the way's flag-down figure plus its figure a kilometre over the
 * straight-line distance, in fifties of naira, times the month's factor), read from content's positions of the two
 * places when their ids are given, so what the sheet says is what the ride takes to the kobo; the minutes are the wait
 * plus the straight-line distance at the way's pace.
 */
export function rideChoices(from: Position, to: Position, country: string | null = null, fareBp = 10000, home = false, ids: { from: string; to: string } | null = null): RideChoice[] {
  const { metresPerMinute, waitMinutes, walkMetres } = content.tuning.city.ride;
  // Abroad there is one way, named for the country, at no fare until the tuning carries fares in that country's money (decision 0011).
  if (country !== null) return [{ id: "danfo", label: mapWords(`map.way.abroad.${country}`), fare: 0, minutes: waitMinutes + ABROAD_MINUTES }];
  const metres = metresBetween(from, to);
  // The month's fares (the fuel scarcity doubles them, R-PLACE-010): the same figure the simulation takes. On foot only within walking distance; past it the walk is shut, so a fare is a real cost.
  // Home is the exception: a life may always walk home, however far, and the long walk is the cost.
  const far = metres > walkMetres;
  const priced = (where: "from" | "to"): Position | null => (ids === null ? (where === "from" ? from : to) : (content.place[ids[where] as keyof typeof content.place]?.position ?? null));
  return WAYS.map((id) => ({
    id,
    label: mapWords(`map.way.${id}`),
    fare: rideFare(content, priced("from"), priced("to"), id, fareBp),
    minutes: waitMinutes + Math.max(1, Math.round(metres / metresPerMinute[id])),
    ...(id === "walk" && far ? (home ? { long: true as const } : { shut: "far" as const }) : {}),
  }));
}
