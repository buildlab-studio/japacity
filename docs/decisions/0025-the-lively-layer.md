# 0025. The game's look

Status: Accepted

## Context

The interface over the world has to read as a game, light and quick to scan on a phone, not as a document of rules. What is the game's own is its world: its models, its city, its clock and its voices. The look has to come from those, so that it reads as this game and no other app.

## Decision

The interface over the world is one light system (`../design/09-the-lively-layer.md`): pale sky surfaces, white cards with a navy edge, danfo yellow for the one action, the Rubik typeface, sticker-cut pictures of the game's own models on every choice, tilted sticker chips, soft tints by kind of act, and the same shapes in navy at the world's night; a centred column on a laptop. The acts of a thing fan out of the thing in the scene as round sticker buttons (the fan, world:fan-of-sticker-buttons), with a sheet as the fallback. A chapter's step, one brief on the road out (`../rules/chapter.md`), is a mission card handed over by a person, with a marker at the place. Street talk keeps a budget: two channels (pictures over people, and words over a person near the player's figure) and at most three callouts over the scene at once (world:street-talk-budget).

The look dresses the gameplay and leaves its structures as they are: the phone, a handset with its apps that rises over the scene; the top band, the strip with the character's name, age, place and money (world:top-band-is-a-pill); the map and the ride; the world and its things; the data page; and the two lights over the start screen (account:two-lights-and-wink-lines). The simulation knows nothing of it.

## Consequences

- The pictures come from the game's models (the `tile` view in `tools/assets/shoot.ts` and the table from ids to models), so every act or thing added needs its picture.
- The fan keeps the player's eye in the scene; the night follows the world's clock (decision 0011); the words keep their registers (`../rules/text.md`).
- The tokens and type live in `apps/client`, the primitives in `apps/client/src/shared/ui`; the rules that carry the look are on `../rules/world.md` and `../rules/text.md`.

## Alternatives

- A common app dress: a rounded font on grey cards with bright pills and emoji tiles, a sand palette, patterned strips at a sheet's edge, a display face on headlines. Each is cheap to reach for, and together they would make the game look like many other apps.
