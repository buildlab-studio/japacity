# Assets and visuals

## Context and scope

Why the game's 3D city, its people and its vehicles are made as they are, kept small, and kept looking like one game. This page gives the reasons; the rules every model follows, with their numbers, are on [the assets rules](../rules/assets.md), and the pipeline that applies them is decision 0009. The models are code in `../../models/` and `../../packages/model-kit/`, and the experiments behind writing models as code are in `../research/12-models-written-as-code.md`.

## Goals and non-goals

**Goals.**

- A 3D city and people that read as Lagos on a cheap phone's screen.
- Every model written as code, so a change is a change of numbers and the whole city can be rebuilt.
- Every model within its budget, and every shipped file in the register.

**Non-goals.** Video of any kind (reward clips, an opening clip, moving chapter cards, cutscenes, video made per player); portraits generated live; a voiced radio; assets from another game; commercial music without a licence; streaming formats for short clips.

## 1. Aim

The city, its people and its vehicles are drawn to the standard players of 3D phone games expect, within a download a cheap phone on Nigerian data can take. A few details a hurried game would skip give it its own look, such as satellite dishes that all face one satellite (assets:dishes-face-one-satellite) and a gele copied from photos of real ones.

## 2. Rendering engine

React Three Fiber on three.js, each pinned to an exact version in `apps/client/package.json` (decision 0009). **The three.js version is pinned** because its releases rename and remove features, so its migration notes are read before any upgrade.

## 3. How each kind of asset is made

Everything in the city is written as code. The register (`models/register.json`) shows it: every model and picture is the makers' own code, and the only generated media is the officer's voice ([Audio](05-audio.md)).

| Category | How it is made | Where |
|---|---|---|
| Vehicles: the danfo, the keke, the okada, and the buses, trains and vans abroad | Written as code | `models/vehicles/` |
| Buildings, stalls, props | Assembled from the kit, a set of parts written as code (walls, floors, roofs, parapets, balconies, stairs, gates, tanks, generators, dishes, signboards), with numbers per building (assets:buildings-assembled-from-kit) | `packages/model-kit/src/kit/`, `models/buildings/`, `models/props/`, `models/places/` |
| Signage | Text drawn onto a texture in code at run time, so the spelling is exact (assets:sign-text-drawn-in-code) | `packages/model-kit/src/sign.ts`, `models/signs.json` |
| Bodies and the skeleton | Written as code, on one shared skeleton | `models/people/` |
| Everyday clothes and hair: low cut, cornrows, braids | Written as code | `models/people/` |
| Agbada, gele, fila, afro, locs, faces | Written as code from reference photos that are looked at, never kept (assets:no-reference-photos-kept). The soft shapes are blended and thinned when the model is built (assets:organic-shapes-baked-at-build) | `models/people/` |
| Fabric patterns: ankara, adire, aso oke | Drawn in code from a seed, in palette colours only, tiling by construction (assets:fabric-pattern-from-seed) | `packages/model-kit/src/pattern.ts` |

**How a model is checked.** The model is blocked out, refined, and compared against a reference photo. Then its builder renders fixed views (assets:contributor-renders-fixed-views), someone who has not seen the code scores them (assets:blind-reviewer-scores-views, assets:acceptance-score-thresholds), the build check measures it against its budget and the palette, and a landmark is also scored against traced outlines (assets:landmarks-match-reference-outlines). Whatever made a model never grades its own work. A new outfit, hairstyle or vehicle variant is a set of numbers, not new code (assets:variants-are-numbers-not-code), so the review stays on the few parts that are new.

## 4. People

- **Everyone shares one skeleton and one set of poses** (`models/people/poses.ts`). Poses are rotations only, so they work on every body.
- **A character is data**: body, build, skin tone, hair, headwear, top, bottom, robe, pattern seeds (`models/people/people.data.ts`).
- Skin tone is a colour, from eight tones. Body types are numbers on the same skeleton.
- Hair and headwear are rigid pieces on the head: low cut, afro, braids, cornrows, locs, gele, fila, cap.
- Clothing is part of the body's mesh and moves with the same bones. Robes and wrappers follow the legs, so they still work when sitting.
- A long wrapper shortens the stride. Stride is a number on the outfit.
- Patterns are small tiling textures drawn from a seed: ankara, adire, aso oke.
- **People ship as model files** (`apps/client/public/assets/shared/person`), not built on the device from their data, so a phone spends nothing on building them. Each person's measured triangles, draw calls and bytes are in its register row, inside the `person_` budget.
- **Poses are written in code**, with no animation library.

### Who wears what

- **A street is about half modern dress and half traditional.** The traditional cloth is part of the game's look, so it stays visible.
- **Everyday dress is mostly modern**: T-shirts, jeans, polos, shirts, office wear, crop tops, mini skirts, fitted dresses, wide-leg trousers.
- **Daily traditional dress** is for market women, traders and older people.
- **Occasions bring out the rest**: aso ebi, gele and agbada at weddings and faji nights (evening parties); jalamia and cap on Fridays.
- **Headgear and caps are worn by a minority**, never by everyone.
- **Modern cuts in traditional cloth** sit between the two, as in Lagos street style: an ankara two-piece, an adire corset top with denim.

| Place or day | Leans |
|---|---|
| Market, roadside | Traditional: wrapper, head tie |
| Office, tech hub, campus | Modern |
| Friday | Jalamia, kaftan, cap |
| Saturday wedding, faji night | Aso ebi, gele, agbada |

The mix per place is a number in data (city:dress-mix-by-place). The world runs on the real calendar, so Friday and Saturday dress changes by itself.

The gele is copied from photos of real ones: a pleated fan behind the head, wrapped bands on the forehead, a knot by one ear.

### Bodies

Bodies vary. Modern women in particular are not all one shape, and men come slim, gym fit and big. Every person draws a few numbers, and a street mixes them:

| Who | Numbers |
|---|---|
| Women | Shape (straight to figure 8), bust (small to busty), size (slim to plus size), height (short to tall) |
| Men | Mass (slim to big), muscle (gym fit), height |
| Everyone | A face of seven small numbers drawn from the person's name, so no two are the same |

- Plus-size and short women wear the same crop tops, minis and fitted dresses as everyone else. Clothes are fitted to the body's numbers, never the other way round.
- Arms, calves and neck follow the same numbers, so a full body does not sit on thin limbs.

No one in the game wears a school uniform, a hijab or an abaya, and there is no traffic officer.

## 5. Shared model rules

A few shared rules make every model look like part of one game. Each is on [the assets rules](../rules/assets.md); here is why.

1. **One palette** (assets:colours-from-named-palette). Models made by different hands at different times still sit together when every colour comes from one named list. The palette grows only by a named colour with a reason: `lagoon` is the muddy grey green of the water under the Third Mainland Bridge, because `teal` is a cloth colour and makes the lagoon look like a swimming pool.
2. **One scale** (assets:metre-units-and-origin, assets:people-and-door-sizes). A person, a door and a storey that agree are what make a street read as real.
3. **Flat and smooth shading** (assets:flat-and-smooth-shading, assets:organic-shapes-baked-at-build). Flat faces suit hard-edged things and cost nothing; smooth shading on round parts costs no triangles either. Soft shapes such as an afro or a gele are finished when the model is built, so the phone does no work for them.
4. **Light set by the place** (assets:lighting-set-by-place). One sun and one sky per place keep every model lit the same way, and shadows only where they help the eye (characters and vehicles) keep cheap phones fast.
5. **One skeleton and one set of poses** for every person, so any pose works on any body.

## 6. Budgets

Every model and every place has a budget of draw calls, triangles and bytes, and the game as a whole has a download budget. The figures are on [the assets rules](../rules/assets.md#budgets-for-one-asset) and in `models/budgets.json`, where the build check reads them (assets:assets-and-places-within-budget). The code a first visit downloads has its own tighter budget, part by part, in `tools/check/size-budget.json` (engine:first-download-has-budget).

- **Why a small first load.** In Nigeria the time a player waits costs more than the data, and the risk is a player who leaves before the game starts. Cheap phones (Tecno, Infinix, Itel) are a large share of the market, so the first load holds only the code, the hub and one character.
- **Why budgets per place.** Each place loads when the player enters it and is cached after that (city:places-load-on-entry), so what matters on a cheap phone is what one place draws and downloads, not the whole game.
- **Why two graphics modes.** A phone that cannot keep up gets a lighter scene, and one that can gets the full one (city:two-graphics-modes). Both modes are held to the place budgets.

## 7. Files and the register

A model's code and its render sheets live in `models/`, which is never shipped ([its README](../../models/README.md)). The shipped files live under `apps/client/public/assets/`, where each kind goes as [the prefixes table](../rules/assets.md#prefixes) says. Keeping the source apart from what ships means the client's build needs neither the builders nor a browser.

A render sheet is the set of fixed views a model's builder renders for its review. Shipped files follow assets:shipped-file-naming, and decision 0009 says how they are published under names that carry a hash of their contents.

**The register** (`models/register.json`) has one row per shipped file, with where it came from, its licence, who approved it, its measured figures and its review (assets:register-matches-every-file; its columns are in [the register](../rules/assets.md#the-register)). With every file in one list, the credits, the licences and the budgets can all be checked by a script instead of by memory.

## 8. The share card and the atmosphere

| Feature | What | Weight per player |
|---|---|---|
| **The japacity card** | A shareable image at big moments and at the send-off, drawn on the device from the game's own art, with no face ([the share rules](../rules/share.md)) | About 150 KB, small enough to send on any data plan (`tuning.share.maxBytes`) |
| **Atmosphere made in code** | Day and night on the world's clock, with the sky and fog tinted by it; wind in cloth and leaves; the weather on landing abroad; small motion on every action; in the high mode, the far haze and the sky's atmosphere | No download beyond the place |

**How the visuals are checked.** The play driver plays the game in a real browser so the screens can be judged from screenshots ([the play driver](../site/built/working.md#the-play-driver)).

## 9. Generated media

Generated media is used only when it is honest about what it is and never stands in for play. The game's only generated media is the officer's voice.

1. **Say so.** The game states plainly where generated media is used: the "How this game was made" page and the credits name it (guide:generated-media-named-plainly). The EU's disclosure duty covers generated media that resembles real people, places or events, and naming every piece is simpler than judging each one.
2. **No faces.** Nothing generated shows a face, and a share card never shows one (share:card-art-shows-no-face).
3. **Generated media never tells the story.** The story is played, and every spoken line is also shown as text.
4. **Everything can be skipped.** A tap skips a spoken line.
5. **A person approves it** before it ships, and its register row says who (assets:ai-media-recorded-and-credited).

## 10. Alternatives considered

- **Babylon.js.** Checked and not worth switching to: its React binding is far less used than React Three Fiber, and its strengths do not address the game's limits, which are download size and cheap phones.
- **An image-to-3D service** for vehicles, reduced and recoloured. Vehicles written as code sit far under the `vehicle_` budget (their measured figures are in the register), and code changes by numbers.
- **Free model packs**, recoloured onto the palette. Every model would carry a licence and a look of its own; the kit in code gives one look.
- **Blender driven by script.** A second tool to install and maintain; the kit in code needs none.
- **A free base character on a shared rig.** Bodies written as code on one skeleton stay within the budget and vary by numbers.
- **Artist-made meshes** for the agbada, the gele, the afro and faces. These shapes carry the most identity and are the hardest to write as code. An artist's time pays most as drawn silhouettes and paint-overs for the code to copy.
- **Avatar services.** A third party's look and a third party's terms for every person in the game.
- **Video clips** at key moments and at the opening. Each would cost 0.5 to 2.5 MB, show faces that never match the player's character, and stand in for play; the game has none.
