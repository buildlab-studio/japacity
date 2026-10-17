// The money the character lives on, and the way home as the engine forecasts it before the player commits
// (docs/rules/place.md R-PLACE-011): the view carries the fare, where it comes from, the shape and the standing.
import { content } from "@japacity/content";
import type { Currency, PlayerView } from "@japacity/sim";

/** The currency of the country the character is in, or null at home and on the road. */
export function localCurrency(view: Pick<PlayerView, "place">): Currency | null {
  const { where, country } = view.place;
  if (where !== "abroad" || country === null) return null;
  return content.country[country]?.currency ?? null;
}

/** The way home from where the character is today, as the engine forecasts it (R-PLACE-011), or null when not abroad. */
export function wayHome(view: Pick<PlayerView, "place">): PlayerView["place"]["wayHome"] {
  return view.place.wayHome;
}
