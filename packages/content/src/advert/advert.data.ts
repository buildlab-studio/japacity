// From docs/rules/adverts.md, "Entries: slots". A slot is where an
// advert may show; which campaign fills it is the server's (R-ADVERT-008).
import type { AdvertSlotEntry, Id } from "@japacity/sim";

const KIB = 1024;

/** The phone's app grid is not a place in the city; its one tile names this instead (R-ADVERT-002). */
export const PHONE = "phone";

// The page's places are descriptions. The motor park is stylised (R-CITY-023) and a slot
// may not stand there, so the park billboard is at Jibowu's coach terminals; the arrivals poster is
// at Heathrow, where most flights from Lagos land; the market street's food spot is Ogba's.
export const advertTable: Record<Id<"advert">, AdvertSlotEntry> = {
  "advert.road-billboard": { id: "advert.road-billboard", surface: "billboard", place: "place.third-mainland-bridge", width: 1024, height: 512, maxBytes: 200 * KIB },
  "advert.park-billboard": { id: "advert.park-billboard", surface: "billboard", place: "place.jibowu", width: 1024, height: 512, maxBytes: 200 * KIB },
  "advert.airport-poster": { id: "advert.airport-poster", surface: "poster", place: "place.airport-lagos", width: 512, height: 768, maxBytes: 150 * KIB },
  "advert.arrivals-poster": { id: "advert.arrivals-poster", surface: "poster", place: "place.heathrow", width: 512, height: 768, maxBytes: 150 * KIB },
  "advert.phone-tile": { id: "advert.phone-tile", surface: "phone-tile", place: PHONE, width: 256, height: 256, maxBytes: 50 * KIB },
  "advert.food-spot": { id: "advert.food-spot", surface: "shopfront", place: "place.ogba", width: 768, height: 192, maxBytes: 100 * KIB },
};
