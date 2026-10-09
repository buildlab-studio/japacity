// The map's own words and the ride's working numbers (docs/rules/world.md R-WORLD-015 to 017), first
// drafts in the voice of docs/rules/text.md. Content's table wins over these, so each key can move
// into content to be rewritten.
import { text } from "@japacity/content";

import { hasWords, words } from "../../shared/words/text";
import type { RideChoice } from "../../shared/world/contract";

export const mapText: Record<string, string> = {
  "map.title": "Map",
  "map.close": "Close the map",
  "map.country": "Country",
  "map.stops": "Stops",
  "map.hint": "Tap a stop to go there",
  "map.state.here": "You are here",
  "map.state.home": "Home",
  "map.state.been": "Been here",
  "map.state.can": "Can go",
  "map.state.not": "Not yet",
  "map.line.here": "You are here. {things} things to do.",
  "map.line.things": "{things} things to do here.",
  "map.line.not": "Not yet. It opens later in this life.",
  "map.ways": "How to go",
  "map.way.danfo": "Danfo",
  "map.way.keke": "Keke",
  "map.way.okada": "Okada",
  "map.way.walk": "On foot",
  "map.walk": "Walk there",
  "map.walk-home": "Walk home",
  "map.way.minutes": "{minutes} min",
  "map.way.abroad.country.uk": "Bus",
  "map.way.abroad.country.canada": "Bus",
  "map.way.abroad.country.uae": "Taxi",
  "map.way.abroad.country.italy": "Bus",
  "map.go": "Go by {way}",
  "map.go-home": "Home by {way}",
  "map.short": "{amount} short",
  "map.stay": "Stay here",
  "map.not-yet": "Not yet",
  "map.not-now": "Not now",
  "map.ride.to": "{way} to {place}",
  "map.ride.skip": "Skip",
  "map.ride.arrived": "{place}",

  // District names painted on the ground, by the area slug content gives each place.
  "map.area.surulere": "Surulere",
  "map.area.yaba": "Yaba",
  "map.area.mushin": "Mushin",
  "map.area.ikeja": "Ikeja",
  "map.area.kosofe": "Kosofe",
  "map.area.oshodi": "Oshodi",
  "map.area.ebute-metta": "Ebute Metta",
  "map.area.lagos-island": "Lagos Island",
  "map.area.ikoyi": "Ikoyi",
  "map.area.victoria-island": "Victoria Island",
  "map.area.amuwo-odofin": "Amuwo Odofin",
  "map.area.iganmu": "Iganmu",
  "map.area.akoka": "Akoka",
  "map.area.lagos-lagoon": "Lagos Lagoon",
};

/** Words for a map key: content's first, then the interface's, then the map's own drafts. */
export function mapWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? words(key) : undefined) ?? mapText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The ways in the order the sheet lists them: cheapest first. */
export const WAYS: readonly RideChoice["id"][] = ["danfo", "keke", "okada", "walk"];
