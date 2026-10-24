# Models written as code: the evidence

The evidence behind `../design/06-assets-and-visuals.md` sections 2 and 3 and `../design/05-audio.md` section 8: four asset experiments of our own, and the library figures read when the engine and the sound library were chosen.

## The asset experiments

Source: the makers' own experiments, built with the code that became `../../models/` and `../../packages/model-kit/`, rendered in a headless browser and scored by a reviewer who had not seen the code. The reviewer was an AI model, not a Nigerian viewer. The date of each run was not recorded.

### Vehicles and props

A danfo, a keke and a market stall written as three.js code in one pass, judged from two renders each.

| Model | Triangles | Draw calls | Size after compression | Budget |
|---|---|---|---|---|
| Danfo | 816 | 1 | 12.7 KB | 3,000 triangles, 100 KB |
| Keke | 668 | 1 | 10.8 KB | 3,000 triangles, 100 KB |
| Market stall | 664 | 1 | 14.2 KB | |

### People

Eight people written as code: bodies, skin tones, five hairstyles, gele, fila, agbada, buba and iro, everyday clothes, and fabric patterns drawn from a seed. The reviewer scored the renders, the code was fixed, and the reviewer scored them again.

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

- Bodies, the skeleton, everyday clothes and patterns can be written as code far under every budget.
- One round of fixes mended or reduced what broke in motion: the robe when seated was mended; the wrapper and the torn shoulders were better but not clean.
- Two rounds did not fix the shapes that carry the most identity: the agbada's drape, the gele, the afro. The code needs a drawn silhouette to copy.

### Modern dress and body shapes

A body with a shape number from regular to figure 8, crop tops, a mini skirt, a fitted dress, wide-leg trousers, long hair, heels, a bag, sunglasses and two poses. The reviewer scored the body 4 out of 5 and judged a waist-to-hip width of about 0.55 right for the style, with 0.48 too much. The gele was rebuilt from photos of real ones: a pleated fan behind the head, wrapped bands on the forehead, a knot by one ear.

### More people and a loaded okada

Each built after looking at reference photos: senator suits, jalamia and kufi, gym-fit, slim and everyday men, a market woman, three hawkers with loads on their heads, and an okada with a rider and a passenger. With the earlier runs, 34 people and 4 vehicles, all between 684 and 1,566 triangles and 10 to 34 KB each.

## Library figures

| Library | Weekly downloads | Read |
|---|---|---|
| three.js | 24.3 million | Week of 28 Sep 2026, npm |
| React Three Fiber | 7.1 million | Date not recorded, npm |
| Babylon.js's React binding | About 15,000 | Date not recorded, npm |
