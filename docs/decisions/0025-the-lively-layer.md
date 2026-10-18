# 0025. The lively layer

Status: Accepted

## Context

The interface over the world has to read as a game, light and quick to scan on a phone, not as a document of rules. What is the game's own is its world: its models, its city, its clock and its voices. Common dresses (a rounded font on grey cards with an orange pill and emoji tiles, a sand palette, a patterned strip at a sheet's edge, a display face on headlines) would make it look like many other apps.

## Decision

The interface over the world is one light system (`../design/09-the-lively-layer.md`): pale sky surfaces, white cards with a navy edge, danfo yellow for the one action, Rubik, sticker-cut pictures of the game's own models on every choice, tilted sticker chips, soft tints by kind of act, and the same shapes in navy at the world's night; a centred column on a laptop. The acts of a thing fan out of the thing in the scene (the fan, world:fan-of-sticker-buttons) with a sheet as the fallback. A journey step is a mission card handed over by a person, with a marker at the place. Street talk keeps a budget of two channels and three callouts (world:street-talk-budget).

The gameplay, the simulation and every structure stay: the handset with its apps, the band, the map and the ride, the world and its things, the data page, the two lights, the lamps.

## Consequences

- The pictures come from the game's models (the `tile` view in `tools/assets/shoot.ts` and the table from ids to models), so every new act or thing needs its picture.
- The fan keeps the player's eye in the scene; the night follows the world's clock (decision 0011); the words keep their registers (`../rules/text.md`).
- The tokens and type live in `apps/client`, the primitives in `apps/client/src/shared/ui`; the rules that carry the layer are on `../rules/world.md` and `../rules/text.md`.
