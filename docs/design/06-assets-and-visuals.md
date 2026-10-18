# Assets and visuals

> Evidence: our own four experiments, below. Their builders are the code in `../../assets-src/` and `../../packages/assets/`.
> **Generate as much as possible.**
> Budgets, the palette size, and the naming scheme are working values, set at or below published figures.

## 1. Two aims

1. **A 3D city and characters** at the standard players expect.
2. **Beyond that**, a small number of touches a game built in a hurry will not have.

## 2. The engine stays

React Three Fiber on three.js. Babylon.js was checked and is not worth switching to: its React binding has about 15,000 weekly downloads against 7.1 million, and its strengths do not address our limits, which are download size and cheap phones.

**The three.js version is pinned**, and its migration notes are read before any upgrade. Recent releases renamed and removed features.

## 3. Where assets come from

| Category | Try first | Fallback | Human time |
|---|---|---|---|
| Vehicles: danfo, keke, okada | **Written as code.** Proven in our own experiment below | An image-to-3D service, reduced and re-coloured | A 20-minute look at the render sheets |
| Buildings, stalls, props | A kit of parts written as code, plus free pack pieces re-coloured onto our palette | Blender driven by script | A batch review |
| Signage | Text drawn onto a texture in code, so spelling is exact | An image model for painted backgrounds | None |
| Bodies and the skeleton | **Written as code**, on one skeleton of 17 bones. Proven in our own experiment below | A free base character on one shared rig, reduced to about 3,000 triangles | Approve three or four body types |
| Everyday clothes, low cut, cornrows, braids | **Written as code.** Scored 3 to 4 out of 5 by an independent reviewer | Outfit pieces from a free pack | A batch review |
| Agbada, gele, fila, afro, locs, faces | Written as code from reference photos. Code alone scored 2 to 3 out of 5 | Artist-made meshes on our skeleton | **The one place an artist's time pays most**: silhouette sketches and paint-overs |
| Fabric patterns | Drawn in code from a seed, limited to the palette, tiling by construction | An image model with a tiling check | A spot check |

**Experiment 1: vehicles and props.** A danfo, a keke, and a market stall were written as three.js code in one pass and rendered in a headless browser.

| Model | Triangles | Draw calls | Size after compression | Budget |
|---|---|---|---|---|
| Danfo | 816 | 1 | 12.7 KB | 3,000 triangles, 100 KB |
| Keke | 668 | 1 | 10.8 KB | 3,000 triangles, 100 KB |
| Market stall | 664 | 1 | 14.2 KB | |

These are first drafts judged from two renders. They show the route works for vehicles and props.

**Experiment 2: people.** Eight people were written as code: bodies, skin tones, five hairstyles, gele, fila, agbada, buba and iro, everyday clothes, and fabric patterns drawn from a seed. A separate reviewer who had not seen the code scored the renders, the code was fixed, and the reviewer scored them again.

| Measure | Result | Budget |
|---|---|---|
| Triangles per person | 680 to 1,200 | 3,000 |
| Draw calls | 1 to 3 | 3 |
| File with skeleton and patterns, compressed | 9.9 to 32.2 KB | 150 KB |
| Bones | 17, shared by everyone | |
| Poses that work on every body | Stand, walk, arms raised, sit | |

| Reviewer's score out of 5, after fixes | Parts |
|---|---|
| 4 | Everyday clothes, low cut, cornrows, readability at phone size |
| 3 | Body, braids, locs, gele, fila, agbada, buba and iro, patterns, walk, sitting |
| 2 | Afro, faces |

**What it means:**

- **Bodies, the skeleton, everyday clothes, and patterns can be generated.** They are far under every budget.
- **One round of code fixed or reduced what was broken in motion**: the robe when seated is fixed, the wrapper and the torn shoulders are better but not clean.
- **Two rounds did not fix the shapes that carry the most identity**: the agbada's drape, the gele, the afro. The code needs a drawn silhouette to copy, and that is what an artist's hour buys.
- The reviewer is an AI, not a Nigerian viewer.

**How generated assets are kept good:**

1. Block out, refine, then compare against a reference photo.
2. Render fixed views in a headless browser and feed the screenshots back to whatever made the asset.
3. A separate reviewer writes the report. Whatever made an asset never grades its own work.
4. A script checks triangles, size, scale, and that only palette colours are used.
5. **For shapes that must be recognised, score the outline against a reference outline** from a sketch or photo, and accept only above a threshold.
6. A new outfit, hairstyle, or vehicle variant is a set of numbers, not new code.

**Not used:**

- One open AI 3D model whose licence excludes the UK.
- Free tiers of AI 3D tools.
- Any asset from another game.
- Avatar services. The best known closed in January 2026.

## 4. Characters

- **One skeleton of 17 bones and one set of animations for everyone.** Poses are rotations only, so they work on every body.
- **A character is data**: body, build, skin tone, hair, headwear, top, bottom, robe, pattern seeds.
- Skin tone is a colour, with eight tones. Body types are numbers on the same skeleton.
- Hair and headwear are rigid pieces on the head: low cut, afro, braids, cornrows, locs, gele, fila, cap.
- Clothing is part of the body's mesh and moves with the same bones. Robes and wrappers follow the legs, so they survive sitting.
- A long wrapper shortens the stride. Stride is a number on the outfit.
- Patterns are small tiling textures drawn from a seed: ankara, adire, aso oke.
- **People ship as model files** (`apps/client/public/assets/shared/chr`), not built on the device from their data.
- **Animations are written in code**, as the four poses were, with no animation library.

**Who wears what.**

- **A street is about half modern dress and half traditional.** The traditional cloth is part of what makes the game look like itself, so it stays visible.
- **Everyday dress is mostly modern**: T-shirts, jeans, polos, shirts, office wear, crop tops, mini skirts, fitted dresses, wide-leg trousers.
- **Daily traditional dress belongs to market women, traders, and older people.**
- **Occasions bring out the rest**: aso ebi, gele, and agbada at weddings and faji nights. Jalamia and cap on Fridays.
- **Headgear and caps are on a minority**, never on everyone.
- **Modern cuts in traditional cloth** sit between the two: an ankara two-piece, an adire corset top with denim. Lagos street style does this.

| Place or day | Leans |
|---|---|
| Market, roadside | Traditional: wrapper, head tie |
| Office, tech hub, campus | Modern |
| Friday | Jalamia, kaftan, cap |
| Saturday wedding, faji night | Aso ebi, gele, agbada |

The mix per place is a number in data. The world runs on the real calendar, so Friday and Saturday dress can change by itself.

**Built in a third experiment**: a body with a shape number from regular to figure 8, crop tops, a mini skirt, a fitted dress, wide-leg trousers, long hair, heels, a bag, sunglasses, and two poses. The reviewer scored the body 4 out of 5 and said a waist-to-hip width of about 0.55 is right for this style, with 0.48 too much. The gele was rebuilt from photos of real ones: a pleated fan behind the head, wrapped bands on the forehead, a knot by one ear.

**Bodies vary.** Modern women in particular must not all be one shape, and men come slim, gym fit, and big. Every person draws a few numbers, and a street mixes them. All are built:

| Who | Numbers |
|---|---|
| Women | Shape (straight to figure 8), bust (small to busty), size (slim to plus size), height (short to tall) |
| Men | Mass (slim to big), muscle (gym fit), height |
| Everyone | A face of seven small numbers drawn from the person's name, so no two are the same |

- Plus-size and short women wear the same crop tops, minis, and fitted dresses as everyone else. Clothes are fitted to the body's numbers, never the other way round.
- Arms, calves, and neck follow the same numbers, so a full body does not sit on thin limbs.

**Built in a fourth experiment**, each after looking at reference photos: senator suits, jalamia and kufi, gym-fit and slim and everyday men, a market woman, three hawkers with loads on their heads, and an okada with a rider and passenger. That makes 34 people and 4 vehicles, all between 684 and 1,566 triangles and 10 to 34 KB each.

**Not in the game**: older people, school uniforms, hijab and abaya, a traffic officer.

## 5. Rules that make mixed sources look like one game

1. One small shared colour texture for everything. No texture per asset, except patterns.
2. One unit is one metre. Adults are 1.7 m. Doors are 2.1 m.
3. Flat shading on hard-edged things (buildings, vehicles' panels, props); smooth shading on round parts (heads, hair, wheels, pots, domes). Soft organic shapes (an afro, locs, a gele, a face) are blended from simple shapes, thinned and shown smooth when the model is built, never on the phone. At most two materials per asset, shapes that read at phone size (assets:flat-and-smooth-shading).
4. One sun and one sky light. Shadows only for characters and vehicles, and only in high-graphics mode.
5. Every character shares one rig and one set of proportions.

The palette grows only by a named colour with a reason (assets:colours-from-named-palette). `lagoon` (#4f6f66) is one: the muddy grey green of the water under the Third Mainland Bridge, because `teal` is a cloth colour and makes the lagoon read as a swimming pool.

## 6. Budgets

| Scope | Draw calls | Triangles in view | Download |
|---|---|---|---|
| First load: code, the hub, one character | 60 | 60,000 | **5 MB** |
| An interior | 50 | 40,000 | 0.8 MB |
| An exterior | 80 | 80,000 | 1.5 MB |
| A character with clothes and hair | 3 | 3,000 | 150 KB |
| A vehicle | 2 | 1,500 to 3,000 | 100 KB |
| The whole game | | | 40 MB |

- **Why 5 MB**: data is about ₦6 per 10 MB, so money is not the issue. Abandonment is. A portal's data from a comparable market showed 60% of players reaching gameplay at 10 MB.
- **Why it matters here**: Tecno, Infinix, and Itel make up about 42% of phones.
- Each place loads when the player enters it, and is cached after.
- The game starts in low-graphics mode and raises quality when the phone keeps up.
- **A build check fails** if any budget is exceeded or any file is missing from the register.

## 7. Files and the register

```
assets-src/<category>/<name>/        the code and the sheets that make a model. Never shipped
public/assets/shared/<category>/     characters, props, vehicles
public/assets/places/<place>/        one place: its buildings and its place.json
chr_ada.glb, veh_danfo.glb, prop_bed.glb
```

**The register** (`assets-src/register.json`) has one row per file: file, place, source, author, licence, attribution text, whether generated and with which tool, who approved it, date, whether modified, triangles, draw calls, materials, bytes, the review and the status (assets:register-matches-every-file).

## 8. Beyond the baseline

Six touches beyond the baseline, each with its weight and what to watch for.

| # | Touch | Weight per player | Watch for |
|---|---|---|---|
| 1 | **The japacity card**: a shareable image at big moments and at the send-off, sized for WhatsApp | About 150 KB | Generated faces. Use composed artwork |
| 2 | **Atmosphere made in code**: day and night, harmattan haze, rain, rim light, small motion on every action | Under 1 MB | Outdated three.js calls |
| 3 | **Radio you can hear**: news bulletins in Nigerian English and Pidgin, driving the news mechanic | About 100 KB per 30 seconds | Stiff Pidgin. A native speaker reviews every voice |
| 4 | **Faceless reward clips**, 3 to 6 seconds: the passport stamp, the embassy queue, the plane window, the arrivals hall | 0.5 to 1 MB each, fetched when earned | A shown face will never match the player's character |
| 5 | **Chapter cards that move**: one image shifted with depth, for each chapter and each era | About 200 KB | Style drift. One locked style reference |
| 6 | **One opening clip**, 15 to 20 seconds, skippable, and reused as the trailer | About 2.5 MB once | Passing it off as gameplay. Label it |

**How the clips are made**: stills first, then animated. One locked style reference for every shot. Short takes, several per shot.

**How the visuals are checked**: the game exposes its state as text and a way to step time, and the play driver (`pnpm play`, `tools/play/`) plays it in a real browser so the screens are judged from screenshots.

## 9. Rules for AI-made media

Players have punished some uses hard. One game replaced its cutscenes with AI video and fell to 36% positive reviews before reversing. Another was cancelled a day after showing AI art.

1. **Say so.** The game states plainly where generated media is used. The worst reactions came when it surfaced later. A clip made with a generation tool carries a small "Made with AI tools" line in its corner while it plays, and the opening clip says so on its first frame: the EU's disclosure duty covers generated media that resembles real people, places or events, and labelling every clip is simpler than judging each.
2. **No faces in clips.** Hands, places, objects, backs.
3. **Clips reward moments. They do not tell the story.** The story is played.
4. **Everything is skippable.**
5. **A person approves every image, clip, and voice.**

## 10. Left out

- Video generated per player. Slow, costly, and needs moderation.
- Portraits generated live.
- Story cutscenes in AI video.
- Streaming formats for short clips.
- Commercial music without a licence.
