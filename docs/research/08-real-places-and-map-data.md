# Real places and map data

> Research, 7 Oct 2026. Short. The question: should the game use prominent real places, in Nigeria and in the countries people leave for, and can a maps service supply them?
> Not checked: where Nigerians settle in each destination country.

## 1. The answer in short

- **Yes to real places.**
- **No to fetching them from Google Maps.** Its terms do not let us keep what we fetch.
- **Open map data can be kept and shipped**, with attribution.
- **The game needs a short hand-picked list per city**, perhaps 30 to 60 names. Data is for checking names and positions. It is not for generating a map.

## 2. What the data sources allow

| Source | Can we store it and ship it in the game | Conditions |
|---|---|---|
| Google Maps Places | **No.** Place ids can be kept. Latitude and longitude for up to 30 days, then deleted. Nothing else may be cached | Attribution when shown. Charged per request |
| Overture Maps, places | **Yes** | Licences: CDLA Permissive 2.0 and Apache 2.0. Commercial use allowed. Attribution required |
| Overture Maps, buildings and roads, and OpenStreetMap | **Yes** | Open Database Licence. Attribution required. A database built from it must be shared on the same terms |

## 3. Three kinds of name, three rules

| Kind | Examples | Rule |
|---|---|---|
| Public places: areas, roads, markets, bridges, bus stops, airports | Oshodi, a named market, a named bridge, the arrivals hall of a named airport | **Use the real name.** This is where the feeling of home comes from |
| Institutions the journey passes through: visa centres, test centres, embassies, banks, universities | | **Use plain descriptions**: "the visa centre", "the English test centre". The game shows queues, refusals, and fees, and a real brand should not be the villain |
| Private businesses: restaurants, shops, airlines | A well-known amala spot | **A made-up name by default. The real name when the business agrees or pays.** The game has advert slots in the world, so a real business as a place is something to sell |

## 4. Abroad

The same rule applies in each destination: the real airport, the real city and area names, plain descriptions for institutions, made-up or agreed names for businesses. Which areas to show turns on where Nigerians actually settle in each route country, which is not checked here.

## 5. What it means for the game

- The `place` kind carries: city, country, area, the real name if any, rough position, the data source and its licence, and a sponsor if any.
- The assets register records licences and attribution text; each place records its data source and licence.
- A credits screen carries the map data attribution.

## Sources

- [Google Maps Platform service terms, 1 May 2025](https://cloud.google.com/archive/maps-platform/terms/maps-service-terms-20250501)
- [Overture Maps: attribution and licences](https://docs.overturemaps.org/attribution/)
