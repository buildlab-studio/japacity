# The sources of the city's models

This folder is never shipped. It holds the builders, specs, outlines and reviews of every model under `apps/client/public/assets/`, the stage they are shot on, and the register.

- How a model is made, shot, reviewed and registered: [decision 0009](../docs/decisions/0009-models-are-code.md).
- The rules every model follows: [the assets rules](../docs/rules/assets.md). Its Prefixes table says where each kind ships.
- Why the models are made this way: [Assets and visuals](../docs/design/06-assets-and-visuals.md).

## The folders

A shipped asset `<prefix>_<slug>` has its source in `<folder>/<slug>/`:

- a `build.ts` (code using the kit in `@japacity/model-kit/kit`) or a `spec.json` (kit data);
- `outline.json` if it was traced;
- `review.json` once reviewed;
- the shooter's `renders/`.

| Folder | Id prefix | Holds |
|---|---|---|
| `buildings/` | `building_` | Buildings from the kit. A building with variants keeps one folder per variant (`a/`, `b/`) inside its own, shipped as `building_<slug>_a` and so on |
| `landmarks/` | `landmark_` | Landmarks, each with its outline and outline score |
| `people/` | `person_` | People. The body, clothes, hair and poses are code at the top of the folder (`people.ts`, `people.data.ts`, `poses.ts`, the blend and the thinning); each person's folder holds only its renders and review |
| `props/` | `prop_` | Props, shared or belonging to one place |
| `shopfronts/` | `shopfront_` | Shopfront bays with their awnings |
| `vehicles/` | `vehicle_` | Vehicles |
| `places/` | the piece's own | One folder per place: the place's `review.json` for the place as a whole and, for a place whose pieces are built together, its `build.ts` and a folder per piece (`places/farm-italy/crop-row/`) |
| `share/` | none | The review of the share cards' art and the link previews |
| `stage/` | none | The page every asset is shot on (assets:contributor-renders-fixed-views) |

## The files at the top

| File | Holds |
|---|---|
| `register.json` | One row per shipped file (assets:register-matches-every-file): every file the game ships, so the voice, the share pictures, the brand marks and the fonts as well as the models |
| `manifest.json` | The SHA-256 of every render and pattern the tools wrote (assets:no-reference-photos-kept) |
| `budgets.json` | The budgets for one asset and for one place, which the build check reads |
| `review.config.json` | The review sheet's numbers and criteria |
| `examples.json` | The examples every new piece is judged against |
| `signs.json` | Where the sign words live |

## Commands

The asset commands (`assets:export`, `assets:shoot`, `assets:outline`, `assets:credits`, `assets:publish`, `check:assets`) run from the repository root, with their code in `tools/assets/`. They are listed in [Working on it](../docs/site/built/working.md#commands), and each script states its usage in its first lines.
