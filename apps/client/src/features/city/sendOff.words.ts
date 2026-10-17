// The send-off scene's own words (docs/rules/chapter.md R-CHAPTER-012, world.md R-WORLD-037), first drafts in the voice
// of docs/rules/text.md. Content's table wins over these, so each key can move into content and be rewritten there. The talk is content's own: the airport's overheard lines,
// Papa's at the gate, each hub's first line and the family's first messages. No figure is written here: the flight's
// amount comes from the tuning, and the money on the band from the view.
import { text } from "@japacity/content";

import { hasWords, words } from "../../shared/words/text";

const sendOffText: Record<string, string> = {
  // Beat 1: Departures.
  "sendoff.band.departures": "Departures, Ikeja",
  "sendoff.queue.ahead": "Departures · {count} ahead",
  "sendoff.queue.ahead.one": "Departures · 1 ahead",
  "sendoff.queue.next": "Departures · you are next",
  "sendoff.queue.front": "Departures · the counter",
  "sendoff.counter.desk": "CHECK-IN {n}",
  "sendoff.step": "Step forward",
  "sendoff.not-yet": "Not yet",

  // Beat 2: the counter.
  "sendoff.counter.by": "The counter",
  "sendoff.counter.ask": "Window or aisle?",
  "sendoff.seat.window": "Window",
  "sendoff.seat.aisle": "Aisle",
  "sendoff.flight": "Flight · {amount}",
  "sendoff.flight.employer": "Flight · Paid by the employer",
  "sendoff.passport": "FEDERAL REPUBLIC\nOF NIGERIA",
  "sendoff.passport.word": "PASSPORT",
  "sendoff.take": "Take the stub",

  // Beat 3: the gate.
  "sendoff.band.gate": "Gate 12, Ikeja",
  "sendoff.gate.sign": "GATE 12 · {city}",

  // Beat 4: the plane (R-WORLD-037). The city as the plane's sticker names it, by the hub place's city in content.
  "sendoff.plane.line": "The plane lifts off. Lagos gets small.",
  "sendoff.plane.small": "One way from Lagos",
  "sendoff.plane.city.london": "London",
  "sendoff.plane.city.calgary": "Calgary",
  "sendoff.plane.city.dubai": "Dubai",
  // Castel Volturno has no airport of its own: the plane comes down at Naples, the city the rule names.
  "sendoff.plane.city.castel-volturno": "Naples",

  // Beat 5: out into the place, by country. The person at the stop says the hub's first overheard line.
  "sendoff.landing.by.country.uk": "Aunty at the stop",
  "sendoff.landing.by.country.canada": "Neighbour at the stop",
  "sendoff.landing.by.country.uae": "Man at the corner",
  "sendoff.landing.by.country.italy": "Brother at the stop",
  "sendoff.landing.weather.country.uk": "4 degrees · no coat yet",
  "sendoff.landing.weather.country.canada": "Minus twenty · snow coming down",
  "sendoff.landing.weather.country.uae": "41 degrees · not one cloud",
  "sendoff.landing.weather.country.italy": "15 degrees · wind off the sea",
  "sendoff.landing.marker.country.uk": "Peckham Rye · the room is four stops away",
  "sendoff.landing.marker.country.canada": "Northeast Calgary · the room is up the long road",
  "sendoff.landing.marker.country.uae": "Deira · the room is past the creek",
  "sendoff.landing.marker.country.italy": "Castel Volturno · the room is down the coast road",
  "sendoff.landing.go.country.uk": "Get on the bus",
  "sendoff.landing.go.country.canada": "Get in the truck",
  "sendoff.landing.go.country.uae": "Get in the taxi",
  "sendoff.landing.go.country.italy": "Get on the bus",
  "sendoff.landing.blind.country.uk": "12 · {hub}",
  "sendoff.landing.blind.country.italy": "VIA DOMITIANA",
  "sendoff.band.landing.country.uk": "{hub}, London",
  "sendoff.band.landing.country.canada": "{hub}",
  "sendoff.band.landing.country.uae": "{hub}, Dubai",
  "sendoff.band.landing.country.italy": "{hub}, Italy",

  // Beat 6: the first ride, by country.
  "sendoff.ride.said": "So this is it.",
  "sendoff.ride.marker.country.uk": "Rye Lane · 2 stops to go",
  "sendoff.ride.marker.country.canada": "The long road · nearly there",
  "sendoff.ride.marker.country.uae": "Along the creek · nearly there",
  "sendoff.ride.marker.country.italy": "Via Domitiana · 2 stops to go",
  "sendoff.band.ride.country.uk": "Rye Lane, London",
  "sendoff.band.ride.country.canada": "The long road, Calgary",
  "sendoff.band.ride.country.uae": "Along the creek, Dubai",
  "sendoff.band.ride.country.italy": "Via Domitiana, Italy",
  "sendoff.saved": "Send-off card saved",
  "sendoff.ring": "Ring the bell",
  "sendoff.phone": "Phone",
  "sendoff.map": "Map",
  "sendoff.phone.pings": "{count} new messages",
};

/** A key of the scene's words, content's table first. Counts take the `.one` form at one. */
export function sendOffWords(key: string, params: Record<string, string | number> = {}): string {
  const counted = typeof params.count === "number" && params.count === 1 && (text[`${key}.one`] !== undefined || sendOffText[`${key}.one`] !== undefined) ? `${key}.one` : key;
  const template = text[counted] ?? sendOffText[counted] ?? (hasWords(counted) ? words(counted) : undefined) ?? counted;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (params[name] === undefined ? whole : String(params[name])));
}
