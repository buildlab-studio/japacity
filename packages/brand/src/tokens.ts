// The game's role colours as apps/client/src/index.css sets them (world:colours-are-role-tokens), for a picture drawn outside the client:
// the teaser wears the same two paints.
export const DAY = {
  sky: "#eaf3fb",
  skyDeep: "#dae8f5",
  card: "#ffffff",
  ink: "#131a33",
  ink2: "#56607e",
  edge: "#1c2a5e",
  cut: "#ffffff",
} as const;

export const NIGHT = {
  sky: "#1c2a5e",
  skyDeep: "#18234f",
  card: "#243470",
  ink: "#f3efe6",
  ink2: "#b6bedf",
  edge: "#f3efe6",
  cut: "#f3efe6",
} as const;

export type Paint = typeof DAY | typeof NIGHT;

export const NAVY = "#1c2a5e";
export const YELLOW = "#f2b705";
export const CREAM = "#f3efe6";
export const DEVICE = "#0d1124";
export const GREEN = "#1d7346";

/** Soft tints by kind: food peach, study blue, money green, body lilac, people rose. */
export const TINT = {
  food: "#ffe8dc",
  study: "#dde9fb",
  money: "#dcf5e6",
  body: "#ebe3f7",
  people: "#fde0e8",
  plain: "#eaf3fb",
} as const;

export const FONT = "Rubik, system-ui, sans-serif";
