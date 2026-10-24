# 0026. The painted map that folds

Status: Accepted

## Context

The map has to show the city at a glance on every phone, carry the player between neighbourhoods and the places in them, and read as Lagos: the lagoon between the mainland and the island, the Third Mainland Bridge across it, Makoko on stilts, the stadium, the danfos. It has to stay cheap on a phone: a cut to another small scene beats cleverness in one.

## Decision

The map is one painted city drawn as SVG in the game's sticker style (decision 0025), at two zooms (world:map-is-painted-lagos). Folded, it is the strip, a narrow band at the top of the screen (the city's landmarks, tiny; a dot for the neighbourhood you are in, a house for home, a yellow dot for the step's place, the place of the chapter's current step) over a neighbourhood card you swipe between, the same drawing zoomed in on that district with its places standing as stickers of their own tiles, the sticker being the pin. A drag or a tap on the strip unfolds the whole map; a tap on a district or a pin folds it back while that neighbourhood's card rises. A ring marks only where you are, the stop picked and the step's place, and names show only on those, on home and on a place never visited. The route is a dotted yellow line with a danfo on it. The map opens on the card of the neighbourhood you are in, or on the step's when a step is live. The night paint darkens the paper and lights the stickers. Abroad each country has its painted map in the same form (world:painted-maps-abroad).

## Consequences

- The map runs with no 3D renderer and is the game's own stickers at a larger size.
- The fold makes the two zooms one thing a player learns once: a paper map that puts itself away.
- There is no fly-over and no list fallback; a stops list serves screen readers.
- The map draws the places; the ride, the countries and the fares are decision 0017's.

## Alternatives

- A 3D map: a second renderer's worth of work on a phone, and its pins fight its buildings.
