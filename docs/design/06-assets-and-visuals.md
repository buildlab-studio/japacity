# Assets and visuals

## Context and scope

How the game's 3D city, its people and its vehicles are made, kept small, and kept looking like one game: where each kind of model comes from, how a model is checked, the rules every model follows, the budgets, and the rules for generated media. The models are code in `../../models/` and `../../packages/model-kit/` (decision 0009). The rules are on `../rules/assets.md`, the budgets are in `../../models/budgets.json`, and the experiments behind writing models as code are in `../research/12-models-written-as-code.md`.

## Goals and non-goals

**Goals.**

- A 3D city and people that read as Lagos on a cheap phone's screen.
- Every model written as code, so a change is a change of numbers and the whole city can be rebuilt.
- Every model within its budget, and every shipped file in the register.

**Non-goals.** Video of any kind (reward clips, an opening clip, moving chapter cards, cutscenes, video made per player); portraits generated live; a voiced radio; assets from another game; commercial music without a licence; streaming formats for short clips.

## 1. Aim

The city, its people and its vehicles are drawn to the standard players of 3D phone games expect, within a download a cheap phone on Nigerian data can take. A few details a hurried game would skip give it its own look, such as satellite dishes that all face one satellite (assets:dishes-face-one-satellite) and a gele copied from photos of real ones.

## 2. Rendering engine

React Three Fiber 9.8 on three.js 0.187. **The three.js version is pinned**, and its migration notes are read before any upgrade, because its releases rename and remove features.

## 3. How each kind of asset is made

Everything in the city is written as code. The register shows it: every model and picture is the makers' own code, and the only generated media is the officer's voice (`05-audio.md`).

| Category | How it is made | Where |
|---|---|---|
| Vehicles: the danfo, the keke, the okada, and the buses, trains and vans abroad | Written as code | `models/vehicles/` |
| Buildings, stalls, props | Assembled from the kit, a set of parts written as code (walls, floors, roofs, parapets, balconies, stairs, gates, tanks, generators, dishes, signboards), with numbers per building (assets:buildings-assembled-from-kit) | `packages/model-kit/src/kit/`, `models/buildings/`, `models/props/`, `models/places/` |
| Signage | Text drawn onto a texture in code at run time, so the spelling is exact (assets:sign-text-drawn-in-code) | `packages/model-kit/src/sign.ts`, `models/signs.json` |
| Bodies and the skeleton | Written as code, on one skeleton of 17 bones | `models/people/` |
| Everyday clothes and hair: low cut, cornrows, braids | Written as code | `models/people/` |
| Agbada, gele, fila, afro, locs, faces | Written as code from reference photos that are looked at, never kept (assets:no-reference-photos-kept). The soft shapes are blended and thinned when the model is built (assets:organic-shapes-baked-at-build) | `models/people/` |
| Fabric patterns: ankara, adire, aso oke | Drawn in code from a seed, in palette colours only, tiling by construction (assets:fabric-pattern-from-seed) | `packages/model-kit/src/pattern.ts` |

**How a model is checked:**

1. The model is blocked out, refined, then compared against a reference photo.
2. Its builder renders fixed views with the shooter (`pnpm assets:shoot`; assets:contributor-renders-fixed-views).
3. A reviewer who has not seen the code scores the views and writes the review (assets:blind-reviewer-scores-views). Whatever made a model never grades its own work. A model is accepted at the scores in assets:acceptance-score-thresholds.
4. A script checks triangles, size, scale, and that only palette colours are used (`pnpm check:assets`).
5. A landmark, a shape that must be recognised, is scored against reference outlines from a plan and an elevation (`pnpm assets:outline`; assets:landmarks-match-reference-outlines).
6. A new outfit, hairstyle or vehicle variant is a set of numbers, not new code (assets:variants-are-numbers-not-code).

## 4. People

- **Everyone shares one skeleton of 17 bones and one set of poses.** Poses are rotations only, so they work on every body.
- **A character is data**: body, build, skin tone, hair, headwear, top, bottom, robe, pattern seeds (`models/people/people.data.ts`).
- Skin tone is a colour, from eight tones. Body types are numbers on the same skeleton.
- Hair and headwear are rigid pieces on the head: low cut, afro, braids, cornrows, locs, gele, fila, cap.
- Clothing is part of the body's mesh and moves with the same bones. Robes and wrappers follow the legs, so they still work when sitting.
- A long wrapper shortens the stride. Stride is a number on the outfit.
- Patterns are small tiling textures drawn from a seed: ankara, adire, aso oke.
- **People ship as model files** (`apps/client/public/assets/shared/person`), not built on the device from their data: 34 people, each 1,044 to 2,394 triangles, one or two draw calls, and 23 to 46 KB.
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

The mix per place is a number in data (`traditionalBp` on each place). The world runs on the real calendar, so Friday and Saturday dress changes by itself.

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

These rules make every model look like part of one game:

1. Every colour is a named entry in the one palette, and no model has a texture of its own except fabric patterns and sign text (assets:colours-from-named-palette).
2. One unit is one metre. Adults are 1.7 m. Doors are 2.1 m (assets:metre-units-and-origin, assets:people-and-door-sizes).
3. Flat shading on hard-edged things (buildings, vehicle panels, props); smooth shading on round parts (heads, hair, wheels, pots, domes). Soft organic shapes (an afro, locs, a gele, a face) are blended from simple shapes, thinned and smoothed when the model is built, never on the phone. At most two materials per asset, and shapes that read at phone size (assets:flat-and-smooth-shading).
4. One sun and one sky light, set by the place. Shadows only for characters and vehicles, and only in the high graphics mode (assets:lighting-set-by-place).
5. Every person shares one skeleton and one set of poses.

The palette grows only by a named colour with a reason (assets:colours-from-named-palette). For example, `lagoon` (#4f6f66) is the muddy grey green of the water under the Third Mainland Bridge; `teal` is a cloth colour and makes the lagoon look like a swimming pool.

## 6. Budgets

| Scope | Draw calls | Triangles in view | Download |
|---|---|---|---|
| First load: code, the hub, one character | 60 | 60,000 | 5 MB |
| An interior | 50 | 40,000 | 0.8 MB |
| An exterior | 80 | 80,000 | 1.5 MB |
| A character with clothes and hair | 3 | 3,000 | 150 KB |
| A vehicle | 2 | 3,000 | 100 KB |
| The whole game | | | 40 MB |

These figures are in `models/budgets.json`, where the build check reads them (assets:assets-and-places-within-budget). Within the first load, the code a first visit downloads has a tighter budget: 534,331 gzipped bytes in all, set part by part in `tools/check/size-budget.json` and checked by `pnpm check:size` (engine:first-download-has-budget).

- **Why a small first load**: in Nigeria, data is cheap compared with the time a player waits, and the risk is a player who leaves before the game starts. Cheap phones (Tecno, Infinix, Itel) are a large share of the market.
- Each place loads when the player enters it, and is cached after that.
- A phone with a coarse screen or little memory starts in the low graphics mode and moves up when its frame rate keeps up. A desktop, or a sharp phone with enough memory, starts in the high mode and drops if its frames are slow (city:two-graphics-modes).
- **The build check fails** if any budget is exceeded or any file is missing from the register.

## 7. Files and the register

```
models/<category>/<name>/                       the code that builds a model, and its render sheets. Never shipped
apps/client/public/assets/shared/<category>/    people, props, vehicles
apps/client/public/assets/places/<place>/       one place: its buildings and its place.json
apps/client/public/assets/tiles/                the models' pictures for the interface, as WebP
person_ada.glb, vehicle_danfo.glb, prop_street-bench.glb
```

A render sheet is the set of fixed views a model's builder renders for its review. A shipped file is named `<prefix>_<name>` (assets:shipped-file-naming). `pnpm assets:publish` also writes a copy of each shipped file with a hash of its contents in the name, and the manifest the city's loader reads.

**The register** (`models/register.json`) has one row per shipped file: file, place, source, author, licence, attribution text, whether generated and with which tool, who approved it, date, whether modified, triangles, draw calls, materials, the palette check, the reference, the outline, the review, the name check, the status and bytes (assets:register-matches-every-file).

## 8. The share card and the atmosphere

| Feature | What | Weight per player |
|---|---|---|
| **The japacity card** | A shareable image at big moments and at the send-off, 1080 by 1920, drawn on the device from the game's own art, with no face (`../rules/share.md`) | Under 150 KB |
| **Atmosphere made in code** | Day and night on the world's clock, with the sky and fog tinted by it; wind in cloth and leaves; the weather on landing abroad; small motion on every action; in the high mode, the far haze and the sky's atmosphere | No download beyond the place |

**How the visuals are checked**: the game exposes its state as text and a way to step time, and the play driver (`pnpm play`, `tools/play/`) plays it in a real browser so the screens can be judged from screenshots.

## 9. Generated media

Generated media is used only when it is honest about what it is and never stands in for play. The game's only generated media is the officer's voice.

1. **Say so.** The game states plainly where generated media is used: the "How this game was made" page and the credits name it (guide:generated-media-named-plainly). The EU's disclosure duty covers generated media that resembles real people, places or events, and naming every piece is simpler than judging each one.
2. **No faces.** Nothing generated shows a face, and a share card never shows one (share:card-art-shows-no-face).
3. **Generated media never tells the story.** The story is played, and every spoken line is also shown as text.
4. **Everything can be skipped.** A tap skips a spoken line.
5. **A person approves it.** Each generated file's register row says who approved it (assets:ai-media-recorded-and-credited).

## 10. Alternatives considered

- **Babylon.js.** Checked and not worth switching to: its React binding is far less used than React Three Fiber, and its strengths do not address the game's limits, which are download size and cheap phones.
- **An image-to-3D service** for vehicles, reduced and recoloured. Vehicles written as code sit far under budget (556 to 2,432 triangles, 5 to 14 KB each), and code changes by numbers.
- **Free model packs**, recoloured onto the palette. Every model would carry a licence and a look of its own; the kit in code gives one look.
- **Blender driven by script.** A second tool to install and maintain; the kit in code needs none.
- **A free base character on a shared rig.** Bodies written as code on one 17-bone skeleton stay within the budget and vary by numbers.
- **Artist-made meshes** for the agbada, the gele, the afro and faces. These shapes carry the most identity and are the hardest to write as code. An artist's time pays most as drawn silhouettes and paint-overs for the code to copy.
- **Avatar services.** A third party's look and a third party's terms for every person in the game.
- **Video clips** at key moments and at the opening. Each would cost 0.5 to 2.5 MB, show faces that never match the player's character, and stand in for play; the game has none.
