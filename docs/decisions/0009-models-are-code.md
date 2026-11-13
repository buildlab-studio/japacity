# 0009. The city's models are code, built in Node and checked by a build step

Status: Accepted

## Context

- The city is low-poly 3D drawn from one palette (`../rules/assets.md`, `../rules/city.md`).
- It must run on cheap Android phones.
- Its models have to stay inside budgets, keep to the palette, and be reproducible by anyone with the repository.
- `pnpm check` must be able to prove all that without a graphics card.

## Decision

- Models are written as code, built and compressed in Node, and shot headless in the Playwright Chromium the repository already installs.
- `pnpm check:assets` checks them.
- The 3D client is React Three Fiber on three.js with the WebGL renderer, every version pinned exactly.

### 1. The renderer and the tools

- Pinned exactly in `package.json`: `three` with `@types/three` at the matching release, `@react-three/fiber` 9, the `@gltf-transform` packages (core, functions, extensions) and `meshoptimizer`.
- React Three Fiber 9 accepts React only below 19.4 by its peer range, so React and React Three Fiber are upgraded together.
- The renderer is three's WebGL renderer.

### 2. What to know about these versions

**three.js**

- `HDRLoader`, not `RGBELoader` (no HDR files are loaded).
- Physically based materials are lit differently from releases before r181, so never tune a colour against an older render.
- `PCFShadowMap`, which is soft, not the deprecated `PCFSoftShadowMap`.
- `Timer` or React Three Fiber's frame delta, not `Clock`.
- `FileLoader.load()` returns nothing: use `onLoad` or `loadAsync`.
- Set `matrixWorldNeedsUpdate = true` when setting `matrix` by hand. Build matrices with `makeTranslation` and its kin.
- Call `Object3D.dispose()` on a place's root when the place is left (city:places-load-on-entry).
- Clone before `toTrianglesDrawMode()`.
- Await `SimplifyModifier.modify()`.
- `TextureSource`, not `Source`.
- No environment maps: one sun and one sky light (assets:lighting-set-by-place).

**React Three Fiber 9**

- Element types come from `ThreeElements`.
- Custom classes are declared with `ThreeElement<typeof Class>` and registered with `extend`.
- `CanvasProps`, not `Props`.
- Texture props are not converted to sRGB, so a canvas texture sets `colorSpace = SRGBColorSpace` itself.
- `StrictMode` is inherited from React DOM.
- In tests, `act` comes from `react`.

### 3. How a model is made

1. **Written as code.**
   - A builder is a pure TypeScript function from numbers to a three.js `Group`: `(spec, palette) => Group`.
   - It uses only palette names (assets:colours-from-named-palette), boxes, cylinders, extrusions and its own seed. No clock, no `Math.random`.
   - Kit buildings are data (`BuildingSpec`) given to the kit's builders (assets:variants-are-numbers-not-code, assets:buildings-assembled-from-kit).
2. **Built in Node.**
   - three.js builds geometry without a browser.
   - The export merges every part into one mesh per material, with colours on the vertices.
   - It writes the GLB with `@gltf-transform/core`'s `NodeIO`, not three's `GLTFExporter`, which wants browser objects.
   - Files may leave out normals. The glTF specification asks a loader to use flat normals when none are given, which saves bytes and matches assets:flat-and-smooth-shading.
3. **Compressed** with meshopt (`meshopt({ encoder: MeshoptEncoder, level: "medium", ... })`) before writing. The client decodes with three's `MeshoptDecoder`.
4. **Shot headless.**
   - The shooter opens the stage page in the Chromium that `pnpm exec playwright install chromium` installs. The code holds no browser path.
   - It writes the fixed views, the phone shot and the outline masks (assets:contributor-renders-fixed-views, assets:landmarks-match-reference-outlines).
   - It renders in software (SwiftShader through ANGLE), so the same model gives the same pixels on every run.
5. **Reviewed** on its sheet as `../rules/assets.md` sets out (assets:acceptance-score-thresholds). Whoever made the model writes nothing into `review.json`.
6. **Registered.** The export writes the measured figures into the asset's register row.
7. **Published.**
   - `pnpm assets:publish` publishes each model's tile render and each look's portraits as WebP pictures under `tiles/` (assets:pictures-shipped-light).
   - It copies every shipped file to a name that carries the hash of its contents.
   - It writes the manifest the city's loader reads (city:places-load-on-entry).
   - `pnpm assets:credits` writes `credits.json` from the register and the map data.

### 4. Where things live

```
packages/model-kit/                  the palette (assets:colours-from-named-palette), the kit of parts, the pattern code, the loader
models/                              never shipped
  <category>/<name>/                 build.ts or spec.json, outline.json, review.json, renders/
  people/                            bodies, clothes, hair, poses
  stage/                             the shooting page: lights, sky, ground, the phone street
  register.json                      one row per shipped file (assets:register-matches-every-file)
  budgets.json, review.config.json   the numbers in assets.md
  manifest.json                      the hash of every render and pattern the tools wrote (assets:no-reference-photos-kept)
apps/client/public/assets/           shipped; called public/assets/ in the rule pages
  shared/<category>/                 characters, props, vehicles
  places/<place>/                    buildings, shops, signs, landmarks, and place.json
  tiles/                             the WebP pictures of the models and the looks
  credits.json                       written from the register and the map data (city:credits-screen-attributions)
  manifest.json                      every shipped file and its hashed copy, which sits beside it
tools/assets/                        export, shoot, outline, publish, credits and the build check
```

- Shipped GLB files are committed, so building the client needs neither a browser nor the export. The check proves they match their register rows.
- Commands: `pnpm assets:export <name>`, `pnpm assets:shoot <name>`, `pnpm assets:outline <name>`, `pnpm assets:publish`, `pnpm assets:credits` and `pnpm check:assets`, which `pnpm check` runs.
- The check passes over the hashed copies and the manifest.

### 5. What the build check verifies

| Check | Rule |
|---|---|
| Names | assets:shipped-file-naming |
| A register row for every shipped file and a file for every row, with the triangles, draw calls, materials and bytes read from the file | assets:register-matches-every-file |
| Each file inside its prefix's budget, and each place inside the per-place budget in both graphics modes | assets:assets-and-places-within-budget |
| Every vertex colour and pattern pixel is a palette entry | assets:colours-from-named-palette, assets:fabric-pattern-from-seed |
| Each model stands at y = 0, with its height in its prefix's range | assets:metre-units-and-origin |
| Every image is in the manifest | assets:no-reference-photos-kept |
| An accepted row's review, and a landmark's outline scores | assets:acceptance-score-thresholds, assets:landmarks-match-reference-outlines |
| `credits.json` against the register and the map data | city:credits-screen-attributions |

Every check but the last reads files only. The last draws each staged place in Playwright's Chromium.

## Consequences

- The method needs no artist's tool: a model is a function, reproducible and reviewable as code.
- Building in Node and checking from files keeps `pnpm check` fast, and runnable wherever the one installed Chromium is present.
- Every asset change follows one order: export, shoot, review, register, publish.
- The simulation, its contract and the ledger know nothing of the models: the city reads the view (city:places-change-no-state).

## Alternatives

- **Models made in an artist's tool, Blender among them.** The files would not be reproducible from the repository, and `pnpm check` could not rebuild or prove them without the tool.
- **three's WebGPU renderer.** Its code path changes most from release to release. The phones that matter most are cheap Android phones, where WebGL is the safe choice.
