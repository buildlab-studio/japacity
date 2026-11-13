# 0025. The game's look

Status: Accepted

## Context

- The interface over the world has to read as a game: light and quick to scan on a phone, not a document of rules.
- What is the game's own is its world: its models, its city, its clock and its voices.
- The look has to come from those, so that it reads as this game and no other app.

## Decision

**One light system** for the interface over the world (`../design/09-the-games-look.md`):

- pale sky surfaces and white cards with a navy edge;
- danfo yellow for the one action;
- the Rubik typeface;
- sticker-cut pictures of the game's own models on every choice;
- tilted sticker chips;
- soft tints by kind of act;
- the same shapes in navy at the world's night;
- a centred column on a laptop.

**The fan.** The acts of a thing fan out of the thing in the scene as round sticker buttons (world:fan-of-sticker-buttons), with a sheet as the fallback.

**Mission cards.** A chapter's step, one brief on the road out (`../rules/chapter.md`), is a mission card handed over by a person, with a marker at the place.

**A budget for street talk** (world:street-talk-budget):

- two channels: pictures over people, and words over a person near the player's figure;
- at most three callouts over the scene at once.

**The structures stay.** The look dresses the gameplay and leaves its structures as they are:

- the phone, a handset with its apps that rises over the scene;
- the top band, the strip with the character's name, age, place and money (world:top-band-is-a-pill);
- the map and the ride;
- the world and its things;
- the data page;
- the two lights over the start screen (account:two-lights-and-wink-lines).

The simulation knows nothing of the look.

## Consequences

- The pictures come from the game's models (the `tile` view in `tools/assets/shoot.ts` and the table from ids to models), so every act or thing added needs its picture.
- The fan keeps the player's eye in the scene.
- The night follows the world's clock (decision 0011).
- The words keep their registers (`../rules/text.md`).
- The tokens and type are in `apps/client`, the primitives in `apps/client/src/shared/ui`. The rules that carry the look are on `../rules/world.md` and `../rules/text.md`.

## Alternatives

- **A common app dress:** a rounded font on grey cards with bright pills and emoji tiles, a sand palette, patterned strips at a sheet's edge, a display face on headlines. Each is cheap to reach for, and together they would make the game look like many other apps.
