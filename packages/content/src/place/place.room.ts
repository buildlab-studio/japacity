// The room abroad's name for the country it is in (docs/rules/city.md "Entries: abroad", world:painted-maps-abroad;
// design pages 10 and 11): the room is one country-less entry, so its name per country is a words key of
// its own beside the plain one, and the client reads it here for the band, the map and the home card.
import type { Id } from "@japacity/sim";

import { placeText } from "./place.text";

const ROOM_NAME = "place.the-room.name";

/** The words key of the room's name in a country: `place.the-room.name.<country slug>`, the plain key where none is written. */
export function roomNameKey(country: Id<"country"> | null): string {
  if (country === null) return ROOM_NAME;
  const key = `${ROOM_NAME}.${country.slice("country.".length)}`;
  return placeText[key] === undefined ? ROOM_NAME : key;
}

/** The room's name in a country, in words: "the basement room in north-east Calgary"; "the room" with no country. */
export function roomName(country: Id<"country"> | null): string {
  return placeText[roomNameKey(country)] ?? "";
}
