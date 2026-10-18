// What the map shows and what a ride costs (world:map-is-painted-lagos, world:one-country-at-a-time and world:ride-sheet-shows-fares), as plain
// functions of the view, the kept list and content, so the screen only draws them.
import { content } from "@japacity/content";
import { type Currency, type Id, metresApart, rideFare, type RideWayView, walkPosition, withinMetres } from "@japacity/sim";

import type { Pin, PinState, RideChoice } from "../../shared/world/contract";
import { onMap, RENTED_HOMES } from "../../shared/world/rentedHomes";
import { formatMoney, formatRate } from "../../shared/words/format";
import { mapWords, WAYS } from "./map.words";

export { onMap, RENTED_HOMES };
import type { Position } from "./paper/fit";

/** A pin as the city hands it: the contract's, with the line optional until the city gives one. */
export type MapPin = Omit<Pin, "line"> & { line?: string };

/** A place as the map reads it from content. */
interface MapPlace {
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
 * Until the published models are known, every place with a position stands.
 */
export function mapPins({ places, here, home, homeSpot, been, built, open, name }: PinsInput): MapPin[] {
  return places
    .filter((place) => place.id === home || (onMap(place.id, home) && place.position !== null && (built === null || built.has(place.id))))
    .map((place) => {
      const state: PinState =
        place.id === here ? "here" : place.id === home ? "home" : open !== undefined && !open.has(place.id) ? "not" : been.includes(place.id) ? "been" : "can";
      return { id: place.id, name: name(place.id), state, position: place.position ?? homeSpot, things: place.stages.length };
    });
}

/** A ride abroad by the single way takes about this long over the wait: its distances are not read. */
const ABROAD_MINUTES = 25;

/**
 * The three ways to a place, each with its fare in kobo and its minutes. The fare is the simulation's own figure for
 * `place/ride` (place:rides-between-city-places: the way's flag-down figure plus its figure a kilometre over the
 * straight-line distance, in fifties of naira, times the month's factor), read from content's positions of the two
 * places when their ids are given, so what the sheet says is what the ride takes to the kobo; the minutes are the wait
 * plus the straight-line distance at the way's pace.
 */
export function rideChoices(from: Position, to: Position, country: string | null = null, fareBp = 10000, home = false, ids: { from: string; to: string } | null = null, drive = false): RideChoice[] {
  const { metresPerMinute, waitMinutes, walkMetres, lonMetresPerE3 } = content.tuning.city.ride;
  // Abroad, where the view lists no ways, there is one way, named for the country, at no fare (decision 0017).
  if (country !== null) return [{ id: "danfo", label: mapWords(`map.way.abroad.${country}`), fare: 0, minutes: waitMinutes + ABROAD_MINUTES }];
  const metres = metresApart(from, to, lonMetresPerE3);
  // The month's fares (the fuel scarcity doubles them, place:rides-between-city-places): the same figure the simulation takes. On foot only within walking distance; past it the walk is shut, so a fare is a real cost.
  // Home is the exception while no fare is in hand: the long walk is the cost (world:ride-sheet-shows-fares, `withHomeWalk`).
  const far = !withinMetres(from, to, walkMetres, lonMetresPerE3);
  const priced = (where: "from" | "to"): Position | null => (ids === null ? (where === "from" ? from : to) : (content.place[ids[where] as keyof typeof content.place]?.position ?? null));
  const ways: RideChoice[] = WAYS.map((id) => ({
    id,
    label: mapWords(`map.way.${id}`),
    fare: rideFare(content, priced("from"), priced("to"), id, fareBp),
    minutes: waitMinutes + Math.max(1, Math.round(metres / metresPerMinute[id])),
    ...(id === "walk" && far ? (home ? { long: true as const } : { shut: "far" as const }) : {}),
  }));
  // While the life's car stands at home, Drive is a way of its own, its fuel the fare by distance as
  // the simulation takes it (`place/ride` with `drive`), no wait at a stop, at the pace of the city's traffic.
  if (!drive) return ways;
  const drove: RideChoice = {
    id: "drive",
    label: mapWords("map.way.drive"),
    fare: rideFare(content, priced("from"), priced("to"), "drive", fareBp),
    minutes: Math.max(1, Math.round(metres / content.tuning.thing.drive.metresPerMinute)),
  };
  return [drove, ...ways];
}

/** Farther than any ride inside a city goes (Heathrow is 27 km from Peckham): a pin so far off stands in another country. */
const CITY_REACH_METRES = 80_000;

/**
 * The metres the minutes are read from: content's positions where both places have one, else the pins' (the room has
 * no address of its own and stands at the map's home spot). A distance past any city's reach means a pin stands at
 * another country's spot, so the ride is timed as the shortest, as its fare is the flag-down figure.
 */
function minutesMetres(at: { from: Position; to: Position }, lonMetresPerE3: number): number {
  const metres = metresApart(at.from, at.to, lonMetresPerE3);
  return metres > CITY_REACH_METRES ? 0 : metres;
}

/** The ways abroad the ride sheet can draw and the ride can play (world:ride-abroad-and-workplace): the bus, the train, the taxi, and on foot. */
const DRAWN_ABROAD: ReadonlySet<RideChoice["id"]> = new Set(["bus", "train", "taxi", "walk"]);

/** The country a ride abroad is in and the stops its employer's shuttle serves (the view's `place.shuttles`, place:employer-shuttle-rides-free). */
export interface AbroadContext {
  country: string | null;
  shuttles: readonly string[];
}

/** A way's name on the sheet: the country's own where it has one (the CTrain, the metro), else the way's. */
function wayLabel(id: RideChoice["id"], country: string | null): string {
  const own = country === null ? null : `map.way.${id}.${country}`;
  return own !== null && mapWords(own) !== own ? mapWords(own) : mapWords(`map.way.${id}`);
}

/**
 * The pill of a way that asks nothing for the country's pass or its shuttle, in the country's money ("C$0, transit pass",
 * "AED 0, site bus", "€0, the van"); undefined where the way is paid, or in London, whose pill stays the bus pass's own.
 */
function pillOf(way: RideWayView, country: string | null, shuttle: boolean): string | undefined {
  if (country === null || country === "country.uk") return undefined;
  const key = shuttle ? `map.way.shuttle.${country}` : way.passed ? `map.way.passed.${country}` : null;
  return key === null ? undefined : mapWords(key, { amount: formatMoney(0, way.currency) });
}

/**
 * The ways to a place abroad, from the view's `place.ways` (place:rides-between-city-places, world:ride-abroad-and-workplace): each priced
 * by the simulation's own `rideFare` from content's positions of the two places, so the sheet says what the ride takes to
 * the penny; the bus asks nothing in a month the pass is bought (place:country-pass-covers-ways). Minutes are the wait plus the straight-line
 * metres at the way's pace as at home, the metres a thousandth of a degree of longitude is worth there read from the way. On foot is
 * shut past the walking limit, as the simulation shuts it, the room measured at the country's home spot (`walkPosition`); to the
 * room, the home there, it is the long walk, which `withHomeWalk` shuts while a fare is in hand.
 */
export function waysAbroad(ways: readonly RideWayView[], ids: { from: string; to: string }, at: { from: Position; to: Position }, home = false, fareBp = 10000, context: AbroadContext = { country: null, shuttles: [] }): RideChoice[] {
  const { waitMinutes, walkMetres } = content.tuning.city.ride;
  const positionOf = (id: string): Position | null => content.place[id as keyof typeof content.place]?.position ?? null;
  const from = positionOf(ids.from);
  const to = positionOf(ids.to);
  const country = context.country as Id<"country"> | null;
  const walkFrom = walkPosition(content, ids.from as Id<"place">, country);
  const walkTo = walkPosition(content, ids.to as Id<"place">, country);
  return ways
    .filter((way) => DRAWN_ABROAD.has(way.way))
    .map((way): RideChoice => {
      const id = way.way;
      const metres = minutesMetres(from !== null && to !== null ? { from, to } : at, way.lonMetresPerE3);
      // The simulation shuts a walk only between two places it knows the positions of, the room at the country's home spot.
      const far = id === "walk" && walkFrom !== null && walkTo !== null && !withinMetres(walkFrom, walkTo, walkMetres, way.lonMetresPerE3);
      // The employer's bus to or from the site or the fields asks nothing in any month, as the simulation takes it (place:employer-shuttle-rides-free).
      const shuttle = id === "bus" && (context.shuttles.includes(ids.from) || context.shuttles.includes(ids.to));
      const pill = pillOf(way, context.country, shuttle);
      return {
        id,
        label: wayLabel(id, context.country),
        fare: id === "walk" || way.passed || shuttle ? 0 : rideFare(way, from, to, fareBp),
        minutes: waitMinutes + Math.max(1, Math.round(metres / way.metresPerMinute)),
        ...(far ? (home ? { long: true as const } : { shut: "far" as const }) : {}),
        ...(way.passed ? { passed: true as const } : {}),
        ...(shuttle ? { shuttle: true as const } : {}),
        ...(pill === undefined ? {} : { pill }),
      };
    });
}

/**
 * place:rides-between-city-places, world:ride-sheet-shows-fares: the long walk home is open only while the money held pays no other way
 * there (a way the pass or the shuttle makes free is paid); with a fare in hand it is shut, saying so.
 */
export function withHomeWalk(ways: readonly RideChoice[], have: number): RideChoice[] {
  const payable = ways.some((way) => way.id !== "walk" && way.shut === undefined && way.fare <= have);
  if (!payable) return [...ways];
  return ways.map((way): RideChoice => {
    if (way.long !== true) return way;
    const shut: RideChoice = { ...way, shut: "fare" };
    delete shut.long;
    return shut;
  });
}

/**
 * A fare as the sheet and the ride say it: whole naira or pounds where it is whole, and the pence where a fare has them
 * (a London bus is £1.75, and the sheet must say what the ride takes, place:rides-between-city-places); a balance stays in whole units.
 */
export function fareWords(minor: number, currency: Currency): string {
  return minor % 100 === 0 ? formatMoney(minor, currency) : formatRate(minor, currency);
}
