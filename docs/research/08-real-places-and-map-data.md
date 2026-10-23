# Real places and map data

Sources checked October 2026.

Backs `../rules/city.md`, `../rules/advert.md` (section 3) and `../rules/guide.md` (sections 2 and 5).

## 1. The answer in short

- **Real places, yes.** Real public names give the feeling of home.
- **Google Maps, no.** Its terms do not let a game keep what it fetches.
- **Open map data can be kept and shipped**, with attribution.
- **A short hand-picked list per city.** Map data is for checking names and rough positions, not for generating a map.

## 2. What the data sources allow

| Source | Kept and shipped in the game? | Conditions |
|---|---|---|
| Google Maps Places | **No.** Only latitude and longitude may be cached, for up to 30 consecutive days, then deleted | Places content may not be used with a non-Google map. Attribution when shown |
| OpenStreetMap | **Yes** | Open Database Licence. Attribution required; a database made from it is shared on the same terms. A credits screen is an accepted place for a game's attribution |
| Overture Maps | **Yes** | Buildings, transport, base and divisions: Open Database Licence, with the OpenStreetMap line. Places: mostly CDLA Permissive 2.0, some Apache 2.0 and CC0, each provider with its own line |

Sources: [Google Maps Platform service specific terms, section 14 (Places API)](https://cloud.google.com/maps-platform/terms/maps-service-terms), [OpenStreetMap: copyright and licence](https://www.openstreetmap.org/copyright), [OpenStreetMap Foundation: attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [Overture Maps: attribution and licences](https://docs.overturemaps.org/attribution/).

## 3. Three kinds of name, three rules

| Kind | Examples | Rule |
|---|---|---|
| Public places: areas, roads, markets, bridges, bus stops, stations, airports | Oshodi, a named market, a named bridge, the arrivals hall of a named airport | **The real name**, spelt as on the sign |
| Institutions the journey passes through: visa centres, test centres, embassies, banks, universities, government offices | | **A plain description**: "the visa centre", "the English test centre". The game shows them queueing, refusing and charging, and a real brand should not be the villain |
| Private businesses | A well-known food spot, a mall | **A made-up name by default.** A real name only as plain words on a place the player visits, eats, shops or meets at. Never for a business that lends, charges, employs, sponsors, refuses or can cheat or fail in the game |

The rules in full are in `../rules/city.md` (city:invented-names-for-risky-businesses, city:sponsor-shows-name-only) and `../rules/advert.md` (advert:institutions-never-take-real-names).

## 4. Abroad

The same rules hold in each destination: the real airport, city and area names; plain descriptions for institutions; made-up names for businesses.

## 5. What it means for the game

- A place records its city, country and area, its real name if it has one, a rough position, and the data source with its licence (`../rules/city.md`, city:positions-rough-on-purpose).
- The Credits screen carries the map data attribution (`../rules/guide.md`, guide:credits-carry-map-line).
