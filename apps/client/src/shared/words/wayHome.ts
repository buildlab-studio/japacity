// The money the character lives on, and the way home as the engine forecasts it before the player commits
// (docs/rules/place.md R-PLACE-011): the view carries the fare, where it comes from, the shape and the standing.
import { content } from "@japacity/content";
import { placeCurrency, type Currency, type PlayerView } from "@japacity/sim";

/** The money the character lives on where they are, as the simulation reads the place: naira at home and on the road, the country's own abroad. */
export function localCurrency(view: Pick<PlayerView, "place">): Currency {
  return placeCurrency(view.place, content);
}

/** The way home from where the character is today, as the engine forecasts it (R-PLACE-011), or null when not abroad. */
export function wayHome(view: Pick<PlayerView, "place">): PlayerView["place"]["wayHome"] {
  return view.place.wayHome;
}
