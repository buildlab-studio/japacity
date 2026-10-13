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
  "map.line.here": "{things} things to do",
  "map.line.things": "{things} things to do",
  "map.line.not": "Opens later in this life",
  "map.ways": "How to go",
  "map.way.danfo": "Danfo",
  "map.way.keke": "Keke",
  "map.way.okada": "Okada",
  "map.way.walk": "Walk",
  "map.way.walk-far": "Too far to walk",
  "map.walk": "Walk there",
  // The car of your own: Drive, its fuel the fare.
  "map.way.drive": "Drive",
  "map.drive": "Drive there",
  "map.drive-home": "Drive home",
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
  // Turn back: you get down at the next stop and walk back; the fare is gone (R-WORLD-017, the design).
  "map.ride.turn-back": "Turn back",
  // Where you are as the ride goes, in the card: pulling out, the road, the stop.
  "map.ride.along.start": "Pulling out of {from}.",
  // On foot nothing pulls out: the walk sets off.
  "map.ride.along.start.walk": "Setting off from {from} on foot.",
  "map.ride.along.road.1": "The traffic moves, for once.",
  "map.ride.along.road.2": "A hold-up at the junction, horns going.",
  // The line that names a person is each way's own: the okada's rider, the keke's and the danfo's driver, your own feet.
  "map.ride.along.road.3.okada": "The rider cuts through a side street.",
  "map.ride.along.road.3.keke": "The driver cuts through a side street.",
  "map.ride.along.road.3.danfo": "The driver cuts through a side street.",
  "map.ride.along.road.3.walk": "You cut through a side street.",
  "map.ride.along.road.3.drive": "You cut through a side street.",
  "map.ride.along.near": "Your stop: {to}",
  "map.ride.arrived": "{place}",

  // The pre-roll's one line (R-WORLD-017): the okada's rider, the keke's driver, the danfo's
  // conductor, each in his own voice. The ride's seed picks one of six.
  "map.ride.line.okada.1": "Where you dey go? Climb, make we move.",
  "map.ride.line.okada.2": "Hold me well o. Pothole full this road.",
  "map.ride.line.okada.3": "Mind your leg. The exhaust dey hot.",
  "map.ride.line.okada.4": "This road no good today. I go pass inside street.",
  "map.ride.line.okada.5": "My person, sit well. We go reach sharp sharp.",
  "map.ride.line.okada.6": "Traffic don hold for bridge. I know one corner.",
  "map.ride.line.keke.1": "Enter for back. Sit well, we dey go.",
  "map.ride.line.keke.2": "Hold the bar o. This road no smooth.",
  "map.ride.line.keke.3": "Na only you? I go pick two more for road.",
  "map.ride.line.keke.4": "I no dey enter express. We go pass inside.",
  "map.ride.line.keke.5": "Rain fit fall. If e start, pull the side cover.",
  "map.ride.line.keke.6": "Shift small. Make your bag no touch my back.",
  "map.ride.line.danfo.1": "Oya, enter. We don dey go.",
  "map.ride.line.danfo.2": "Hold your change. I no get small money.",
  "map.ride.line.danfo.3": "Front seat na three. Shift small.",
  "map.ride.line.danfo.4": "Who never pay? Hand am come.",
  "map.ride.line.danfo.5": "Driver, carry go. Everybody don settle.",
  "map.ride.line.danfo.6": "No pay me with that torn note o.",
  // The boy who parks you out, as you drive off.
  "map.ride.line.drive.1": "Oga, I watch your motor. Remember me.",
  "map.ride.line.drive.2": "Reverse, reverse. Small again. You don free.",
  "map.ride.line.drive.3": "Fuel don cost again o. Drive gently.",
  "map.ride.line.drive.4": "Mind that gutter as you dey comot.",
  "map.ride.line.drive.5": "The road don clear. Go now now.",
  "map.ride.line.drive.6": "Wind up your glass for that junction.",

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
  "map.area.ojuelegba": "Ojuelegba",
  "map.area.bode-thomas": "Bode Thomas",
  "map.area.makoko": "Makoko",
  "map.area.lekki": "Lekki",
  "map.area.apapa": "Apapa",
  "map.area.gbagada": "Gbagada",
  "map.water.lagoon": "Lagos Lagoon",
  "map.water.atlantic": "The Atlantic",
  "map.bridge.third-mainland": "Third Mainland Bridge",

  // The neighbourhoods' cards, each name folded into its card's top edge (R-WORLD-015, the folding map).
  "map.card.ikeja": "Ikeja",
  "map.card.yaba": "Yaba",
  "map.card.ojuelegba": "Ojuelegba",
  "map.card.surulere": "Surulere",
  "map.card.bode": "Bode Thomas",
  "map.card.ebute": "Ebute Metta",
  "map.card.makoko": "Makoko",
  "map.card.island": "The island",
  "map.card.lekki": "Lekki",
  // The strip's name for a screen reader: a tap on it opens the whole map.
  "map.unfold": "Open the whole map",
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
export const WAYS: readonly Exclude<RideChoice["id"], "drive">[] = ["danfo", "keke", "okada", "walk"];
