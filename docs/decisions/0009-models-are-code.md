# 0009. The city's models are code, baked in Node and checked by a build step

Status: Accepted

## Context

The city is low-poly 3D drawn from one palette (`../rules/assets.md`, `../rules/city.md`), and it must run on cheap Android phones. Its models have to stay inside budgets, keep to the palette and be reproducible by anyone with the repository, and `pnpm check` must be able to prove that without a graphics card.

## Decision

Models are written as code, built and compressed in Node, shot headless in the Playwright Chromium the repository already installs, and checked by `pnpm check:assets`. The 3D client is React Three Fiber on three.js with the WebGL renderer, every version pinned exactly.

### 1. The renderer and the tools

`three` with `@types/three` at the matching release, `@react-three/fiber` 9, the `@gltf-transform` packages (core, functions, extensions) and `meshoptimizer`, each pinned exactly in `package.json`. React Three Fiber 9 accepts React only below 19.4 by its peer range, so React and React Three Fiber move together, by decision. The WebGL renderer, not WebGPU: the WebGPU path changes most from release to release, and the phones that matter most are cheap Android phones.

### 2. What to know about these versions

- three.js: `HDRLoader`, not `RGBELoader` (no HDR files are loaded); physically based materials are lit differently from releases before r181, so a colour is never tuned against an older render; `PCFShadowMap`, which is soft, not the deprecated `PCFSoftShadowMap`; `Timer` or React Three Fiber's frame delta, not `Clock`; `FileLoader.load()` returns nothing, so use `onLoad` or `loadAsync`; set `matrixWorldNeedsUpdate = true` when setting `matrix` by hand; build matrices with `makeTranslation` and its kin; call `Object3D.dispose()` on a place's root when the place is left (city:places-load-on-entry); clone before `toTrianglesDrawMode()`; await `SimplifyModifier.modify()`; `TextureSource`, not `Source`. No environment maps: one sun and one sky light (assets:lighting-set-by-place).
- React Three Fiber 9: element types come from `ThreeElements`; custom classes are declared with `ThreeElement<typeof Class>` and registered with `extend`; `CanvasProps`, not `Props`; texture props are not converted to sRGB, so a canvas texture sets `colorSpace = SRGBColorSpace` itself; `StrictMode` is inherited from React DOM; in tests `act` comes from `react`.

### 3. How a model is made

1. **Written as code.** A builder is a pure TypeScript function from numbers to a three.js `Group`, `(spec, palette) => Group`, using only palette names (assets:colours-from-named-palette), boxes, cylinders, extrusions and its own seed: no clock, no `Math.random`. Kit buildings are data (`BuildingSpec`) given to the kit's builders (assets:variants-are-numbers-not-code, assets:buildings-assembled-from-kit).
2. **Baked in Node.** three.js builds geometry without a browser. The export merges every part into one mesh per material with colours on the vertices and writes the GLB with `@gltf-transform/core`'s `NodeIO`, not three's `GLTFExporter`, which wants browser objects. Files may leave out normals: the glTF specification asks a loader to use flat normals when none are given, which saves bytes and matches assets:flat-and-smooth-shading.
3. **Compressed** with meshopt (`meshopt({ encoder: MeshoptEncoder, level: "medium", ... })`) before writing. The client decodes with three's `MeshoptDecoder`.
4. **Shot headless.** The shooter opens the stage page in the Chromium that `pnpm exec playwright install chromium` installs, with no browser path in the code, and writes the fixed views, the phone shot and the outline masks (assets:contributor-renders-fixed-views, assets:landmarks-match-reference-outlines). It renders in software (SwiftShader through ANGLE), so the same model gives the same pixels on every run.
5. **Reviewed** on its sheet as `../rules/assets.md` sets out (assets:acceptance-score-thresholds). Whoever made the model writes nothing into `review.json`.
6. **Registered.** The export writes the measured figures into the asset's register row.

### 4. Where things live

```
packages/assets/                     the palette (assets:colours-from-named-palette), the kit of parts, the pattern code, the loader
assets-src/                          never shipped
  <category>/<name>/                 build.ts or spec.json, outline.json, review.json, renders/
  people/                            bodies, clothes, hair, poses
  stage/                             the shooting page: lights, sky, ground, the phone street
  register.json                      one row per shipped file (assets:register-matches-every-file)
  budgets.json, review.config.json   the numbers in assets.md
  manifest.json                      the hash of every render and pattern the tools wrote (assets:no-reference-photos-kept)
apps/client/public/assets/           shipped; called public/assets/ in the rule pages
  shared/<category>/                 characters, props, vehicles
  places/<place>/                    buildings, shops, signs, landmarks, and place.json
  credits.json                       written from the register and the map data (city:credits-screen-attributions)
tools/assets/                        export, shoot, outline and the build check
```

Shipped GLB files are committed, so building the client needs neither a browser nor the export; the check proves they still match their register rows. Commands: `pnpm assets:export <name>`, `pnpm assets:shoot <name>`, `pnpm assets:outline <name>` and `pnpm check:assets`, which `pnpm check` runs.

### 5. What the build check verifies

Names (assets:shipped-file-naming); a register row for every shipped file and a file for every row, with the triangles, draw calls, materials and bytes read from the file (assets:register-matches-every-file); each file inside its prefix's budget and each place inside the per-place budget in both graphics modes (assets:assets-and-places-within-budget); every vertex colour and pattern pixel a palette entry (assets:colours-from-named-palette, assets:fabric-pattern-from-seed); each model standing at y = 0 with its height in its prefix's range (assets:metre-units-and-origin); every image in the manifest (assets:no-reference-photos-kept); an accepted row's review and a landmark's outline scores (assets:acceptance-score-thresholds, assets:landmarks-match-reference-outlines); `credits.json` against the register and the map data (city:credits-screen-attributions). Every check but the last reads files only; the last draws each staged place in Playwright's Chromium.

## Consequences

- The method needs no artist's tool: a model is a function, reproducible, reviewable as code.
- Building in Node and checking from files keeps `pnpm check` fast and runnable where only the one installed Chromium is present.
- Every asset change follows one order: export, shoot, review, register.
- The simulation, its contract and the ledger are untouched: the city reads the view (city:places-change-no-state).
