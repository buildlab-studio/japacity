# Assets

> Rests on `../design/06-assets-and-visuals.md` (budgets, the palette rule, scale, the register, the review method, the rules for AI-made media) and its four asset experiments. The pipeline that applies these rules is `../decisions/0009-models-are-code.md`.
> No kind of the simulation. These are the fixed conventions every contributor follows, and the sheet every piece is judged on. The places that use the assets are in `city.md`.

Every model in the game is built on one palette, at one scale, under one budget, and judged on one sheet by someone who did not build it. The examples (a kit of parts, two buildings from it, two shopfronts with signboards, the National Stadium, and the Third Mainland Bridge) are judged on the same sheet as every other piece, and as accepted examples they are what each new piece is compared with.

## Rules: one look

**assets:colours-from-named-palette** Every colour in every model is a named entry in the one palette file, and the model refers to it by name. A colour enters the palette only by a named addition the maintainer accepts, with a one-line reason. Textures are allowed only for fabric patterns (assets:fabric-pattern-from-seed) and sign text (assets:sign-text-drawn-in-code).

**assets:starting-palette-frozen** The starting palette is the 37 colours of the asset experiments, frozen in `packages/assets/src/__fixtures__/starting-palette.json`, every entry kept with its name and value, plus the additions for streets and buildings in the table below. The four scene colours the experiments hard-coded (sand, asphalt, road marking, sky) are named entries.

**assets:metre-units-and-origin** One unit is one metre. +Y is up. A model faces +Z (the glTF convention). Its origin is the centre of its footprint at ground level, and its lowest point is at y = 0 within 0.01 m.

**assets:people-and-door-sizes** Adults are 1.7 m nominal; built people run from 1.59 m to 1.82 m before hair and headwear, as the asset experiments measured. A single door is 2.1 m high and 0.9 m wide; a double door is 2.1 m by 1.2 m. Every part in the kit takes its sizes from the part table below.

**assets:flat-and-smooth-shading** Flat shading on hard-edged things; smooth shading on round parts (heads, hair, wheels, pots, domes), named per part in the node extras by the contributor who builds the model. The game's loader sets `flatShading` on every material it loads except the parts so named, because the setting does not survive compression (a known fault, seen in the asset experiments). Soft organic shapes are blended from simple shapes, thinned and shown smooth at build time (design 06 section 5 rule 3); the loader never blends. An asset has at most two materials: one opaque vertex-coloured material, and at most one more for a pattern or a sign texture. Glass is a dark palette colour, not a transparent material.

**assets:lighting-set-by-place** One sun and one sky light, set by the place, never by an asset. Shadows are cast only by characters and vehicles, and only in the high mode (`city.md`, city:two-graphics-modes). Every place takes the layer's light by its kind (`lightKindOf`). A home, a place whose file sets `light.room`, gets the rooms' light: a pale sky (0xdfe8f4), a warm floor bounce, a pale backdrop (0xeef1f8), a warm sun at 2.3 and a sky light at 1.35, no haze. An office, any other indoor place, takes the rooms' numbers, a warm floor bounce and no haze. A street takes the pale cool sky light, a warm sun, sun 2.15 and sky 1.25 at noon, its own ground's bounce, and the fog fading into the pale sky. The backdrop and fog are the pale sky everywhere, tinted by the clock. A lamp may carry a real point light, scaled by the world's clock and kept at zero by day so no shader recompiles; a street or an office has at most two a place.

## Rules: budgets

**assets:assets-and-places-within-budget** A shipped asset stays inside its budget in the per-asset table below, measured on the compressed file: triangles, draw calls after baking, materials and bytes. A place stays inside its budget in the per-place table, measured on everything in view from the place's three fixed camera positions with the high mode's sample of people. The build check fails on any figure over budget. A home shell may ship each outer side as a pair, `wall_<side>_full` and `wall_<side>_low`, of which the scene shows one (world:room-seen-down-its-length); a pair counts one draw call and the hidden wall none, each pair adds one draw call to the bld allowance, and triangles and bytes count both walls.

**assets:shipped-file-naming** A shipped file's name is `<prefix>_<name>.<ext>` or `<prefix>_<name>_<variant>.<ext>`: the prefix from the table below, the name in lower case with words joined by hyphens, the variant a letter or a word where there is more than one, and the extension `glb`, `png` or `ktx2`. As a pattern: `^(chr|veh|bld|shop|sign|lm|prop|cloth|hair|anim|tex)_[a-z0-9]+(-[a-z0-9]+)*(_[a-z0-9]+(-[a-z0-9]+)*)?\.(glb|png|ktx2)$`. The build check fails on any other name under `public/assets/`.

## Rules: where things come from

**assets:register-matches-every-file** Every shipped file has one row in the register, and every row names a shipped file. The register's columns are in the table below. The build check fails on a file with no row, a row with no file, or a row whose measured figures differ from the file. `drawCalls` is the draw calls as shown, a wall pair counted once (assets:assets-and-places-within-budget).

**assets:no-real-brands-on-assets** No asset shows a real business name, logo, livery or trade mark: not on a sign, a vehicle, a uniform, a bag or a bottle. Names on assets follow city:four-kinds-of-name: a public place's real name, an institution's plain description, a business's made-up name checked under city:made-up-names-checked, or a sponsor's name only where a place's `sponsor` allows it. A vehicle or a sign that copies a real company's colour scheme so it can be recognised counts as its logo.

**assets:no-reference-photos-kept** No reference photo is ever in the repository. A photo is looked at in a browser, never saved, and only an outline traced from it may be kept, as data: a polygon in metres in `outline.json`, with the URL looked at, the date, the view, and the known dimension that fixes its scale. The build check fails on any image file under `models/` or `public/assets/` that is not listed in the shooter's manifest of renders or the pattern builder's manifest, each with its hash.

**assets:sign-text-drawn-in-code** Text on a sign is drawn in code, at run time, onto a canvas texture, from the place's text keys (`city.md`, city:place-words-are-text-keys), so the spelling is exactly the text table's. A sign texture is at most 512 by 128 pixels and a power of two on each side. Lettering is a font listed in the register with its licence. No sign is ever an image file.

**assets:fabric-pattern-from-seed** A fabric pattern is drawn in code from a seed, uses only palette colours, and tiles by construction (`packages/assets/src/pattern.ts`). It is the only texture an asset may ship. The palette check reads every pixel of it.

**assets:variants-are-numbers-not-code** A new outfit, hairstyle, vehicle variant or building is a set of numbers given to existing builder code, not new builder code. New builder code is a new part, and a new part goes through the review like an asset.

**assets:ai-media-recorded-and-credited** Media made with an AI tool records the tool and the plan in its register row, is approved by a person before it ships, and is named on the credits screen (`../design/06` section 9). A model or picture written as code is the makers' own work, not generated, with no tool named; the register's authors are the makers.

## Rules: the kit of parts

**assets:buildings-assembled-from-kit** An ordinary building is assembled from the kit: walls, floors, roofs, parapets, balconies, stairs, gates, tanks, generators, satellite dishes, signboards and awnings, plus the street parts (burglar bars, fence walls, open drains, poles and wires). A building entry is data: footprint, storeys, roof, wall colour, wear, balconies, stairs, gate, clutter seed and signs. Each part keeps to its size rules in the table below.

**assets:buildings-carry-wear-and-clutter** Every ordinary building carries wear and clutter drawn from its clutter seed: at least two of tank, dish, generator, burglar bars, stains, a hand-painted notice and wires, placed where they would be (a tank on a stand or the roof, a dish on the side facing the sky's one satellite, a small generator by the gate). Wear is a darker named palette colour on lower walls and under roof edges, never a texture.

**assets:neighbours-never-identical** In a street, no two neighbouring buildings share the same footprint, storeys, roof and wall colour together. The street's layout seed decides the parameters, so the same street is built the same way every time.

**assets:dishes-face-one-satellite** Every satellite dish in one place points the same way, because they all face the same satellite. A detail a viewer from Lagos notices and code gets for free.

## Rules: the review

**assets:contributor-renders-fixed-views** The contributor who built the asset renders the fixed views with the shooter (`../decisions/0009-models-are-code.md`): front, back, left and right in orthographic projection; a three-quarter view from 30 degrees above with a 32 degree lens; a plan view from above for buildings and landmarks; and a phone shot at 360 by 640 CSS pixels, device scale 2, with the asset in the standard street stage 12 m from the camera; for a landmark the phone shot is the `phoneFar` view instead, from the distance that frames the whole, because 12 m from a stadium shows one bay. Lighting, sky and ground are the stage's, fixed. Rendering is on the software renderer, so the same model gives the same pixels each time. The 16 looks the door offers are also shot on a clear ground as `face` (128 by 128 at scale 2, the stand pose), `figure` and `cheer` (200 by 400 at scale 2, the hip and cheer poses), published beside the tiles as `tiles/<look>-face.png`, `-figure.png` and `-cheer.png` (`PORTRAITS` in the catalog, `PORTRAIT_VIEWS` in the check).

**assets:blind-reviewer-scores-views** A reviewer who has not seen the code scores the views on the review sheet below, out of 5 for each criterion, and writes `review.json` beside the asset. The contributor never grades their own work and never edits a review. The reviewer gets the renders, this page, the examples sheet and the reference's description, and nothing else.

**assets:acceptance-score-thresholds** An asset is accepted when no criterion scores under 3, "reads at phone size" scores at least 4, the mean is at least 3.5, and the budget criterion is not 0. A landmark must also pass assets:landmarks-match-reference-outlines. The maintainer's eye is the last check for landmarks and for anything that shows a place's name.

**assets:landmarks-match-reference-outlines** A landmark is scored against reference outlines in at least two views, one an elevation and one the plan. For each view: the model is rendered in orthographic projection as flat black on white at the reference's scale, the reference polygon is drawn at the same scale, the frame's longer side is 512 pixels with 5% margin, the two are centred by their bounding boxes and then shifted by up to 3% of the frame to the best overlap, with no rotation and no scaling. The view's outline score is 100 times the overlap area over the union area, rounded down. Where the reference fills less than 10% of its bounding box (a bridge deck, a mast), both masks are first grown by 2% of the frame's longer side, so a thin shape is scored on where it is, not on its width. A landmark passes when every view scores at least `outlineMin` and its bounding width and height are each within `dimTolerancePct` of the reference's.

**assets:plan-outline-from-map-data** A plan outline may be taken from open map data (a building or way in OpenStreetMap) instead of a photo, and is then credited as map data (`city.md`, city:credits-screen-attributions) and recorded in the register. An elevation outline is traced by hand from photos looked at online, under assets:no-reference-photos-kept.

**assets:long-landmark-repeats-segment** A long landmark is built as a repeating segment and its ends. The long landmark is the Third Mainland Bridge, not the cable-stayed Lekki-Ikoyi Link Bridge, because its plain concrete spans carry less design to copy (`city.md`, city:landmarks-built-to-outline), its plan comes from open map data, and the send-off already flies over the lagoon. The bridge is shown as a section of about 600 m with its piers, deck and lamp posts, its plan outline is scored on that section of the OpenStreetMap way, and its elevation outline on three spans of the segment.

## Rules: soft shapes and moving parts

**assets:organic-shapes-baked-at-build** A soft organic shape (the afro, locs, the gele and faces) is made by blending simple shapes into one surface, turning that surface into triangles and thinning them, all when the model is built. The shipped file holds only the finished triangles, inside the asset's budget, and the part is named as a smooth-shaded round part (assets:flat-and-smooth-shading). Nothing is blended or thinned on the phone, and no surface is drawn from blended shapes at run time. The thinned mesh keeps at most `THIN_MAX_PCT` (50%) of the raw triangles, a constant of the puff's test (`models/props/smoke/puff.test.ts`).

**assets:rework-never-scores-lower** A reworked piece is scored by the same kind of reviewer as assets:blind-reviewer-scores-views against its old version: the old and new renders side by side on the review sheet. It replaces the old one only when it passes assets:acceptance-score-thresholds and scores no lower than the old on any criterion. Both sets of pictures stay out of the repository, in a folder `.gitignore` covers (`test-results/`, for one). A lower budget score counts only when a figure leaves its budget; a piece that spends more of its allowance and stays inside it is not worse for that.

**assets:one-shared-motion-material** The motion material is one shared part, written once in the shared code and used by every place (city:one-clock-one-wind, city:motion-in-vertex-shader and city:no-script-loop-per-sheet): the sheet bend, the water grid and the instanced puffs and leaves. No asset ships a shader of its own. A moving sheet names its pinned edge in its node extras (`pinned`: `top`, `bottom`, `left` or `right`, in the sheet's own frame), and the build check fails a sheet with no pinned edge.

**assets:sheets-ship-two-mesh-levels** A place's sheets and water grid ship at two mesh levels, as the file variants `coarse` and `fine` (assets:shipped-file-naming). Both levels keep the same pinned edges and the same outline, so switching level changes only how smooth the motion looks. The place's budget (assets:assets-and-places-within-budget) is checked with `fine` in the high mode and `coarse` in the low mode.

**assets:models-record-their-footprint** Every model records its footprint, the ground it blocks, in its own data (`footprint` in the model's root extras: a list of boxes in metres in the model's own frame, or `none` for a thing people walk under or through), and every place records its walkable ground (`walkable` in `place.json`: polygons in metres) beside its spots. The build check fails a model with no footprint and a place with no walkable ground, and fails a place whose spots or start are not on walkable ground that the footprints leave free. The client's route map (city:tap-to-walk) is built from these and nothing else.

## The palette

The starting palette (assets:starting-palette-frozen), kept as it is:

| Group | Names and values |
|---|---|
| Vehicles and props | `danfoYellow` #f5b800, `black` #1b1b1f, `glass` #27384a, `tyre` #18181a, `hub` #9a9da3, `cream` #fff3c4, `red` #c8321e, `white` #f2f2ee, `wood` #9c6b3f, `darkWood` #6f4a2a, `blue` #2f62b5, `green` #2f8f4e, `tan` #c9a66b, `seat` #5a2f2a, `canvas` #24262b, `tomato` #d9402b, `pepper` #3f9b3c, `basin` #2b78c2 |
| Skin, eight tones | `skin1` #3b2219, `skin2` #4a2c20, `skin3` #5c3826, `skin4` #6f4530, `skin5` #82543a, `skin6` #966544, `skin7` #ab7752, `skin8` #c08b63 |
| Hair and face | `hair` #141112, `hairBrown` #2e1d14, `lip` #4a1f1c |
| Cloth | `indigo` #1f2a6b, `gold` #d9a521, `wine` #7a1f3d, `teal` #1f7a78, `orange` #e2711d, `khaki` #b9a674, `denim` #34527a, `charcoal` #33353b |

Additions, accepted under assets:colours-from-named-palette. Painted block walls in a few soft colours, zinc and coloured long-span roof sheet, laterite ground, and grey concrete are what a Lagos street is made of; one worn shade each is enough for wear.

| Name | Value | For |
|---|---|---|
| `sand` | #d9b27c | Ground (a scene colour of the experiments) |
| `asphalt` | #4a4a4f | Road (a scene colour of the experiments) |
| `marking` | #e9e3d2 | Road lines (a scene colour of the experiments) |
| `sky` | #f3d9a4 | Sky and fog (a scene colour of the experiments) |
| `laterite` | #b5653a | Red earth, unpaved ground |
| `concrete` | #9a958c | Slabs, kerbs, fence walls, unpainted render |
| `concreteWorn` | #6e6a63 | Stains, damp, lower walls |
| `wallCream` | #e8dcc0 | Painted walls |
| `wallCreamWorn` | #c4b79a | |
| `wallPeach` | #e9b48a | Painted walls |
| `wallPeachWorn` | #c58f68 | |
| `wallMint` | #a8d5b5 | Painted walls |
| `wallMintWorn` | #84b092 | |
| `wallSky` | #9cc3d5 | Painted walls |
| `wallSkyWorn` | #7a9fb0 | |
| `zinc` | #a7a9a6 | New roof sheet, gates |
| `zincRust` | #8a4b2c | Old roof sheet |
| `roofRed` | #a3362b | Coloured long-span sheet |
| `roofBlue` | #2f5f8a | Coloured long-span sheet |
| `roofGreen` | #3c6e47 | Coloured long-span sheet |
| `drain` | #5b5a55 | Open drains and their slabs |
| `purple` | #6d2b79 | Used by the fabric patterns outside the starting palette; named here so the pattern passes |
| `lagoon` | #4f6f66 | Lagoon water under the Third Mainland Bridge and at the waterside places: a muddy grey green, which `teal` (a cloth colour) is not |

## Budgets for one asset

| Prefix | What | Triangles | Draw calls | Materials | Compressed size | Height | Source |
|---|---|---|---|---|---|---|---|
| `chr_` | A person with clothes and hair | 3,000 | 3 | 2 | 150 KB | 1.55 m to 2.3 m with headwear | `../design/06` section 6 |
| `veh_` | A vehicle | 3,000 | 2 | 2 | 100 KB | | `../design/06` section 6 |
| `bld_` | An ordinary building from the kit | 1,500 | 1 | 1 | 40 KB | 3 m to 13 m (one to four storeys) | Working value: the experiments' market stall (664 triangles, 14.2 KB) is a third of it; a wide home's shell has one draw call more per wall pair (assets:assets-and-places-within-budget) |
| `shop_` | A shopfront bay with its awning | 1,200 | 2 (body, sign) | 2 | 30 KB | 3 m to 4 m | Working value |
| `sign_` | A free-standing signboard | 100 | 1 | 1 (its canvas) | 4 KB | 1.5 m to 4 m | Working value |
| `lm_` | A landmark | 8,000 | 2 | 2 | 250 KB | | Working value: a tenth of an exterior's triangles |
| `prop_` | A prop: stall, tank, generator, pole, crate | 800 | 1 | 1 | 25 KB | | Working value, the experiments' market stall fits |
| `cloth_`, `hair_` | A garment or hairstyle shipped apart from a person | inside the person's 3,000 | | | inside the person's 150 KB | | `../design/06` section 4 |
| `anim_` | An animation set for the one skeleton | | | | 60 KB | | Working value |
| `tex_` | A pattern | | | | 16 KB, at most 256 px a side | | The experiments' largest pattern was 15.7 KB |

## Budgets for one place

From `../design/06` section 6:

| Scope | Draw calls | Triangles in view | Download |
|---|---|---|---|
| First load: code, the hub, one character | 60 | 60,000 | 5 MB |
| An interior | 50 | 40,000 | 0.8 MB |
| An exterior | 80 | 80,000 | 1.5 MB |
| The whole game | | | 40 MB |

How an exterior's 80 draw calls and 80,000 triangles are shared. Working values, from the experiments' measured people (1 to 3 draw calls, 684 to 1,566 triangles) and vehicles:

| Part | Draw calls, low | Draw calls, high | Triangles, high |
|---|---|---|---|
| People (8 low, 16 high) | 24 | 32 | 24,000 |
| Vehicles, up to 6 | 6 | 6 | 6,000 |
| Ordinary buildings, instanced by kit variant | 10 | 10 | 20,000 |
| Shopfronts and signs | 8 | 8 | 8,000 |
| Props, instanced | 6 | 6 | 5,000 |
| A landmark, if any | 2 | 2 | 8,000 |
| Ground, road, sky | 4 | 4 | 1,000 |
| **Total, with room for effects** | **60** | **68** | **72,000** |

## Prefixes

| Prefix | Holds | Lives in |
|---|---|---|
| `chr_` | People | `public/assets/shared/chr/` |
| `veh_` | Vehicles | `public/assets/shared/veh/` |
| `cloth_`, `hair_` | Garments and hair shipped apart | `public/assets/shared/cloth/`, `.../hair/` |
| `anim_` | Animations | `public/assets/shared/anim/` |
| `tex_` | Patterns | `public/assets/shared/tex/` |
| `prop_` | Props used in several places | `public/assets/shared/prop/` |
| `bld_`, `shop_`, `sign_` | Buildings, shopfronts, signboards of one place | `public/assets/places/<place>/` |
| `lm_` | A landmark | `public/assets/places/<place>/` |

A shipped body is a `chr_`, and a name has at most one variant part (assets:shipped-file-naming).

## The register

One row per shipped file, in `models/register.json` (`../decisions/0009-models-are-code.md`).

| Column | Holds |
|---|---|
| `file` | The shipped path under `public/assets/`; for media made elsewhere (a share card's drawn scene, a link preview), the path from the repository root, with `#<name>` for one piece in a file of code |
| `place` | The place id, or `shared` |
| `source` | `code`, `pack`, `ai-tool` or `artist` |
| `author` | Who made it: the makers for the game's own work, or the third party a file comes from |
| `licence` | Our own work is CC BY-SA 4.0 (`../../LICENSES.md`); a pack is CC0 or CC BY only |
| `attribution` | The text the credits screen shows, or null |
| `generated` | Whether it was made with a generation tool (assets:ai-media-recorded-and-credited, guide:register-records-generated-assets); work written as code is not |
| `tool` | The tool and plan, or null for work made by hand |
| `approvedBy` | Who approved it to ship, or null; an AI-made row is `accepted` only once this names someone |
| `date` | The date it was made or fetched |
| `modified` | Whether a third-party file was changed |
| `triangles`, `drawCalls`, `materials`, `bytes` | Measured from the compressed file by the check |
| `paletteCheck` | Passed, with the date |
| `reference` | What was looked at: the URL and date for each photo, never the photo |
| `outline` | The outline file and each view's score, for a landmark |
| `review` | The reviewer, the date, each criterion's score, the mean |
| `nameCheck` | For a made-up name on a sign: the searches, their date, the result (`city.md`, city:made-up-names-checked) |
| `status` | `draft`, `accepted` or `rejected` |

## The kit of parts

Sizes are in metres. Working values unless a source is given.

| Part | Size rules | Notes |
|---|---|---|
| Wall | 0.23 thick (a 9-inch sandcrete block, 0.225, plus render); internal walls 0.15 (a 6-inch block). Storey 3.0 floor to floor | Blocks are 0.45 long and 0.225 high: openings and storeys land on 0.225 steps where they can (block sizes, Structville and Dutum Group) |
| Floor | Slab 0.15 thick, its edge shown as a band of `concrete` | |
| Roof | Hip or gable at 20 to 30 degrees, eaves 0.6 out, sheet in `zinc`, `zincRust`, `roofRed`, `roofBlue` or `roofGreen`; or a flat slab behind a parapet | |
| Parapet | 1.0 above the roof slab, 0.15 thick, a coping band 0.05 proud | |
| Balcony | 1.2 to 1.5 deep, balustrade 1.0 high, of concrete balusters or a steel rail | |
| Stairs | Rise 0.17, going 0.27, width 1.0 to 1.2, a landing every 12 risers at most. External stairs to upper flats are common | |
| Door and window | Doors as assets:people-and-door-sizes. Windows 1.2 by 1.2, sill at 0.9. Ground-floor windows carry burglar bars | |
| Gate | Vehicle gate 3.0 to 3.6 wide, 2.1 to 2.4 high, sheet steel, with a 0.9 by 2.1 pedestrian door cut in it | |
| Fence wall | 2.4 high, 0.15 thick, a coping band; optional wire on top | |
| Tank | 1,000 litres: 1.2 across, 1.0 high. 2,000 litres: 1.4 across, 1.4 high. On a steel stand 3 to 6 high, or on the roof | The 1,000 litre size is a comparable polyethylene tank's published size (1.23 across, 1.03 high); the local brands publish none |
| Generator | Small petrol: 0.6 long, 0.45 wide, 0.45 high, by the gate or on a balcony. Large soundproof diesel: 2.0 by 1.0 by 1.3, for shops and estates | 2.5 kVA spec sheets give 0.40 to 0.61 a side. The diesel size is a working value |
| Satellite dish | 0.8 to 0.9 across, on a wall bracket or the roof, all facing one way in a place (assets:dishes-face-one-satellite) | 80 to 90 cm is the size installers recommend in the region |
| Signboard | Fascia 0.6 to 0.9 high, the shop's full width; pole sign 1.2 by 0.8 with its bottom edge at 2.4. Capital letters at least 0.2 high | At 12 m with a 32 degree lens on a 640 px tall phone screen, 0.2 m is about 19 CSS px: readable |
| Awning | 1.0 to 1.5 deep, front edge at least 2.2 high (clears a 2.1 door and a 1.7 person), falling 5 to 10 degrees, sheet or canvas | |
| Shopfront bay | 3.0 to 4.0 wide, 3.0 high, a roller shutter box 0.3 deep over the opening | |
| Open drain | 0.45 wide, 0.6 deep, along the street edge, with concrete slabs over it at gates | |
| Pole and wires | Pole 9 high, wires sagging between poles 30 to 40 apart | |

## The review sheet

Each criterion is scored 1 to 5 by the reviewer, except budget, which the check scores.

| Criterion | 5 | 3 | 1 |
|---|---|---|---|
| Reads at phone size | In the phone shot, named in one look, and its key part shows | Named on a second look | Not named |
| Silhouette | The four orthographic outlines alone say what it is | Two of the four do | None do |
| Proportion | Every measured size inside the part rules; doors, storeys and people agree | One size visibly off | Scale wrong |
| Palette use | Palette only, main mass reads against ground and neighbours, wear in the worn shades | Palette only, but flat or muddy against the street | Fails the palette check (the check stops it before review) |
| Wear and clutter | The right clutter for its kind, where it would be (assets:buildings-carry-wear-and-clutter) | Clutter present but generic | A clean box |
| Variety against the examples | Plainly the same family as the accepted examples, and plainly its own | Near a copy of one, or a small break in style | A different style, or identical |
| Budget | At or under 80% of every figure | 4: at or under 100% of every figure | 0: over any figure. Fails |

Acceptance is assets:acceptance-score-thresholds. A landmark adds the outline score (assets:landmarks-match-reference-outlines).

## Numbers

| Setting | Value | Source | Held in |
|---|---|---|---|
| Lowest outline score, every view | 85 | Working value. One code-built project accepts at 90 on every component; 85 leaves room for outlines traced by hand from photos taken in perspective | `models/review.config.json` `outlineMin` |
| Dimension tolerance | 5% | Working value | `dimTolerancePct` |
| Outline frame | 512 px on the longer side, 5% margin, 3% shift search | Working value | `outlineFramePx`, `outlineMarginPct`, `outlineShiftPct` |
| Thin outline growth | 2% of the frame, below 10% fill | So bridges and masts are scorable | `thinFillPct`, `thinGrowPct` |
| Acceptance | No criterion under 3, phone size 4, mean 3.5 | Working value: the experiments' people were accepted at 3 to 4 | `minEach`, `minPhone`, `minMean` |
| Phone shot | 360 by 640 CSS px, device scale 2, 12 m | The experiments' phone shot | `phoneShot` |
| Per-asset and per-place budgets | The tables above | `../design/06` section 6, and working values | `models/budgets.json` |
| Thinned soft shape, most of the raw triangles kept | 50% | Working value. The blended afro of the curves experiment of 8 Oct 2026 went from 1,420 triangles raw to 636 thinned, 45% | `THIN_MAX_PCT` in `models/props/smoke/puff.test.ts` |
| A pot spun from a curve | 336 triangles | The same experiment; for comparison with the `prop_` budget | the reason for assets:organic-shapes-baked-at-build |
| A ball, flat or smooth | 168 triangles either way | The same experiment: smooth shading costs no triangles | the reason for assets:flat-and-smooth-shading |

## Sources

All read on 8 Oct 2026.

- [Structville: sandcrete blocks, sizes and the NIS 87 table](https://structville.com/sandcrete-blocks-production-specifications-uses-and-testing)
- [Dutum Group: standard building block sizes in Nigeria](https://dutumgroup.com/standard-building-block-sizes-in-nigeria/)
- [Homecenter: a 1,000 litre polyethylene tank, 1.03 m high and 1.232 m across](https://www.homecenter.com.co/homecenter-co/product/316067/tanque-de-1000-litros/316067/)
- [Red Band UK: a 2.5 kVA petrol generator, 400 by 445 by 525 mm](https://www.redbanduk.co.uk/stephill-ge2501-2-5kva-generator-petrol)
- [Midlands State University thesis: dish size for satellite television reception, 60 and 90 cm compared](https://cris.library.msu.ac.zw/handle/11408/2592)
- [Wikipedia: Third Mainland Bridge](https://en.wikipedia.org/wiki/Third_Mainland_Bridge)
- [OpenStreetMap Foundation: attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- [glTF 2.0 specification: coordinate system and units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units)

## Not verified

- Nigeria's building code figures for storeys, stairs and balustrades: the code's text could not be found online. The kit's sizes are working values set to common practice and to the block size.
- Tank sizes of the brands sold in Lagos.
- The diesel generator size.

## Contract

These rules put nothing in the simulation's `types.ts`. One small package of types serves the build tools and the client (`packages/assets`):

1. `PaletteName`: the union of the palette's names; `palette: Record<PaletteName, number>` in one file, imported by every builder and by the check.
2. `CharacterLook`: a person as data: `{ body: "f" | "m"; shape: number; bust: number; size: number; mass: number; muscle: number; heightCm: number; skin: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; hair: string; headwear: string | null; top: string; bottom: string; robe: string | null; patternSeeds: number[]; faceSeed: string }`. Used by city:players-fill-the-crowd and by the crowd.
3. `BuildingSpec`: `{ footprint: [number, number]; storeys: 1 | 2 | 3 | 4; roof: "hip" | "gable" | "flat"; wall: PaletteName; wear: 0 | 1 | 2 | 3; balconies: number; stairs: "none" | "front" | "side"; gate: boolean; clutterSeed: number; signs: string[] }`, with `signs` as text keys.
4. `RegisterRow`: the columns above.
5. `Review`: `{ reviewer: string; date: string; scores: Record<"phone" | "silhouette" | "proportion" | "palette" | "wear" | "variety" | "budget", number>; mean: number; outline?: Record<string, number>; notes: string }`.
6. `Outline`: `{ view: "front" | "side" | "plan"; polygon: Array<[number, number]>; source: string; read: string; scaleFrom: string }`, metres.
7. Node extras the loader and the check read: `smooth: true` on a round part (assets:flat-and-smooth-shading), `pinned: "top" | "bottom" | "left" | "right"` on a moving sheet (assets:one-shared-motion-material).
8. `Review` also carries `against?: { file: string; scores: Review["scores"] }` for a rework scored against its old version (assets:rework-never-scores-lower).
9. The thinning limit is `THIN_MAX_PCT` in `models/props/smoke/puff.test.ts`; the build tool that blends and thins lives in `models/`, never in the client bundle.
