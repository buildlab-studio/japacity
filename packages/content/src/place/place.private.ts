// The places that are someone's home (city.md R-CITY-015): no other player is sampled or shown in them. The server's
// presence fetch and the client's crowd both read this one list. Only types are imported, so the place check's page
// loads it by its own path (`@japacity/content/private-places`) without the rest of content.
import type { HomePlace, Id } from "@japacity/sim";

/**
 * Each home a life may live in (`home.md`), and whether it is private. Typed over every home, so a new one fails the
 * typecheck until it is placed here. Makoko is a public neighbourhood scene with the rented room as one thing on its
 * walk, so players show there as at any public place.
 */
const LIVED_IN: Record<HomePlace, boolean> = {
  "place.family-house": true,
  "place.makoko": false,
  "place.compound-room": true,
  "place.hostel-room": true,
};

/** Someone's home: the private homes a life lives in, the room abroad and their room (a friend's or a partner's). */
export const PRIVATE_PLACES: ReadonlySet<Id<"place">> = new Set<Id<"place">>([
  ...(Object.entries(LIVED_IN) as [HomePlace, boolean][]).flatMap(([place, home]) => (home ? [place] : [])),
  "place.the-room",
  "place.their-room",
]);
