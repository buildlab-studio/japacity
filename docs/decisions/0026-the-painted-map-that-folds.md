# 0026. The map is a painted SVG city that folds away

Status: Accepted

## Context

- The map has to show the city at a glance on every phone.
- It has to carry the player between neighbourhoods and the places in them.
- It has to read as Lagos: the lagoon between the mainland and the island, the Third Mainland Bridge across it, Makoko on stilts, the stadium, the danfos.
- It has to stay cheap on a phone: a cut to another small scene beats cleverness in one.

## Decision

**One painted city.** The map is one painted city drawn as SVG in the game's sticker style (decision 0025), at two zooms (world:map-is-painted-lagos). The rule gives the details.

**Folded.** The map is the strip, a narrow band at the top of the screen, over a neighbourhood card.

- The strip shows the city's landmarks, tiny, with a dot for the neighbourhood you are in, a house for home and a yellow dot for the step's place (the place of the chapter's current step).
- The card is the same drawing zoomed in on one district. You swipe between the cards.
- On a card the places stand as stickers of their own tiles; the sticker is the pin.

**Unfolding and folding.**

- A drag or a tap on the strip unfolds the whole map.
- A tap on a district or a pin folds it back, and that neighbourhood's card rises.
- The map opens on the card of the neighbourhood you are in, or on the step's card when a step is live.

**Marks and names.**

- A ring marks only where you are, the stop picked and the step's place.
- Names show only on those, on home and on a place never visited.
- The route is a dotted yellow line with a danfo on it.
- The night paint darkens the paper and lights the stickers.

**Abroad.** Each country has its painted map in the same form (world:painted-maps-abroad).

## Consequences

- The map runs with no 3D renderer and is the game's own stickers at a larger size.
- The fold makes the two zooms one thing a player learns once: a paper map that puts itself away.
- There is no fly-over and no list fallback; a stops list serves screen readers.
- The map draws the places; the ride, the countries and the fares are decision 0017's.

## Alternatives

- **A 3D map:** a second renderer's worth of work on a phone, and its pins fight its buildings.
