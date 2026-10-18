// The design's 34 people as data (assets:variants-are-numbers-not-code): each a set of numbers given to the one builder.
// Names follow assets:shipped-file-naming. The design's `var_` body tests ship as `chr_body_<variant>`, and keep
// their old name as `face`, so each face is the one the design drew.
import type { Garment, PersonSpec } from "./people";

// ---------- eight people, the first experiment ----------
export const PEOPLE: PersonSpec[] = [
  // A person ships one pattern (two materials, assets:flat-and-smooth-shading), so the gele is cut from the outfit's own ankara, as a matching set.
  { name: "chr_amaka", body: "f", skin: "skin3", head: "gele", headFab: 1, shoes: "gold",
    patterns: [{ kind: "ankara", seed: 4, cols: ["indigo", "gold", "orange", "cream"] }],
    top: { type: "buba", sleeve: "wide", hem: 0.86, flare: 0.03, fab: 1 }, bottom: { type: "iro", hem: 0.1, fab: 1, stride: 0.45 } },
  { name: "chr_chief", body: "m", build: 1.22, skin: "skin2", head: "fila", headFab: 1, shoes: "darkWood",
    patterns: [{ kind: "asoOke", seed: 9, cols: ["wine", "gold", "cream"] }],
    top: { type: "buba", sleeve: "long", hem: 0.8, fab: "white" }, bottom: { type: "trousers", ease: 0.016, fab: "white", stride: 0.8 }, over: { fab: "white", trim: "gold" } },
  { name: "chr_tunde", body: "m", skin: "skin4", hair: "lowcut", shoes: "white", phone: true,
    top: { type: "tee", sleeve: "short", hem: 0.93, fab: "green" }, bottom: { type: "trousers", fab: "denim" } },
  { name: "chr_zainab", body: "f", skin: "skin5", hair: "braids", shoes: "red",
    patterns: [{ kind: "ankara", seed: 1, cols: ["teal", "cream", "orange", "wine"] }],
    top: { type: "dress", sleeve: "short", hem: 0.95, fab: 1 }, bottom: { type: "skirt", hem: 0.5, fab: 1 } },
  { name: "chr_emeka", body: "m", skin: "skin1", hair: "locs", hairColor: "hairBrown", shoes: "darkWood",
    patterns: [{ kind: "adire", seed: 2 }],
    top: { type: "buba", sleeve: "long", hem: 0.74, fab: 1 }, bottom: { type: "trousers", ease: 0.014, fab: "indigo" } },
  { name: "chr_ngozi", body: "f", skin: "skin6", hair: "afro", shoes: "black", bag: "tan",
    top: { type: "shirt", sleeve: "long", fab: "wine" }, bottom: { type: "skirt", hem: 0.5, fab: "charcoal" } },
  { name: "chr_corper", body: "m", skin: "skin3", head: "cap", headFab: "khaki", shoes: "orange",
    top: { type: "tee", sleeve: "short", fab: "white" }, bottom: { type: "trousers", ease: 0.012, fab: "khaki" } },
  { name: "chr_kemi", body: "f", skin: "skin7", hair: "cornrows", shoes: "white",
    patterns: [{ kind: "ankara", seed: 8, cols: ["orange", "indigo", "cream", "gold"] }],
    top: { type: "tee", sleeve: "short", hem: 0.93, fab: 1 }, bottom: { type: "trousers", fab: "charcoal" } },
];

// ---------- modern womenswear: one body with a shape number, five looks ----------
const CROP_MINI: { top: Garment; bottom: Garment } = { top: { type: "crop", hem: 1.165, neck: "strapless", straps: true, fab: "white" }, bottom: { type: "skirt", rise: 1.0, hem: 0.74, fab: "denim" } };
export const MODERN: PersonSpec[] = [
  { name: "chr_control", body: "fx", shape: 0, skin: "skin5", hair: "long", shoes: "white", phone: true, ...CROP_MINI },
  { name: "chr_tolani", body: "fx", shape: 0.8, skin: "skin5", hair: "long", heels: true, shoes: "gold", bag: "wine", bagHand: "R", shades: true, ...CROP_MINI },
  { name: "chr_bisi", body: "fx", shape: 0.7, skin: "skin3", hair: "braids", hairLen: 0.98, hairColor: "hairBrown", heels: true, shoes: "black", phone: true,
    top: { type: "dress", neck: "strapless", fab: "wine" }, bottom: { type: "skirt", rise: 1.05, hem: 0.7, fab: "wine" } },
  { name: "chr_ada", body: "fx", shape: 0.5, skin: "skin6", hair: "bun", heels: true, shoes: "cream", bag: "gold", bagHand: "R",
    patterns: [{ kind: "ankara", seed: 4, cols: ["teal", "gold", "orange", "cream"] }],
    top: { type: "crop", hem: 1.15, sleeve: "short", fab: 1 }, bottom: { type: "trousers", rise: 1.1, wide: 0.05, fab: 1 } },
  { name: "chr_sade", body: "fx", shape: 0.3, skin: "skin2", hair: "lowcut", hairColor: "hairBrown", shoes: "white", shades: true,
    patterns: [{ kind: "adire", seed: 2 }],
    top: { type: "corset", neck: "strapless", fab: 1 }, bottom: { type: "trousers", rise: 1.06, wide: 0.045, fab: "denim" } },
];

// ---------- men: senator, jalamia, gym fit, slim, and everyday ----------
export const MEN: PersonSpec[] = [
  { name: "chr_femi", body: "mx", skin: "skin4", hair: "lowcut", beard: true, shades: true, shoes: "darkWood",
    top: { type: "senator", hem: 0.69, sleeve: "long", fab: "cream", placket: "tan" }, bottom: { type: "trousers", ease: 0.012, fab: "cream" } },
  { name: "chr_obi", body: "mx", mass: 0.85, skin: "skin3", head: "kufi", headFab: "red", beard: true, shoes: "black",
    top: { type: "senator", hem: 0.6, sleeve: "half", fab: "indigo", placket: "gold" }, bottom: { type: "trousers", ease: 0.014, fab: "indigo" } },
  { name: "chr_musa", body: "mx", mass: -0.6, height: 1.03, skin: "skin2", head: "kufi", headFab: "white", beard: true, shoes: "darkWood",
    top: { type: "jalamia", hem: 0.14, sleeve: "long", fab: "white", placket: "cream", flare: 0.035 }, bottom: { type: "trousers", fab: "white" }, stride: 0.6 },
  { name: "chr_kunle", body: "mx", muscle: 1, skin: "skin1", head: "beanie", headFab: "black", shoes: "white", holding: "basin",
    top: { type: "tank", fab: "white", ease: 0.004 }, bottom: { type: "trousers", ease: 0.014, wide: 0.03, fab: "hub" } },
  { name: "chr_dayo", body: "mx", muscle: 0.75, skin: "skin5", hair: "lowcut", shoes: "white",
    patterns: [{ kind: "asoOke", seed: 6, cols: ["white", "blue", "white"] }],
    top: { type: "tee", sleeve: "short", fab: 1, ease: 0.004 }, bottom: { type: "trousers", shorts: true, fab: "black" } },
  { name: "chr_tobi", body: "mx", mass: -0.9, height: 1.05, skin: "skin6", hair: "locs", shades: true, shoes: "white",
    top: { type: "tee", sleeve: "half", hem: 0.86, ease: 0.03, fab: "orange" }, bottom: { type: "trousers", ease: 0.012, wide: 0.045, fab: "khaki" } },
  { name: "chr_segun", body: "mx", skin: "skin3", hair: "cornrows", shoes: "white",
    patterns: [{ kind: "asoOke", seed: 14, cols: ["green", "white", "white"] }],
    top: { type: "jersey", sleeve: "short", hem: 0.9, ease: 0.014, fab: 1 }, bottom: { type: "trousers", ease: 0.012, wide: 0.03, fab: "black" } },
  { name: "chr_nonso", body: "mx", mass: 0.35, height: 0.95, skin: "skin7", hair: "lowcut", shoes: "darkWood",
    patterns: [{ kind: "ankara", seed: 5, cols: ["danfoYellow", "cream", "orange", "white"] }],
    top: { type: "shirt", sleeve: "half", hem: 0.9, ease: 0.016, fab: 1 }, bottom: { type: "trousers", ease: 0.012, wide: 0.02, fab: 1 } },
  // assets:people-and-door-sizes: the three short bodies stand at least 1.59 m bare.
  { name: "chr_bayo", body: "mx", height: 0.94, skin: "skin4", hair: "lowcut", shoes: "black", bag: "darkWood",
    top: { type: "shirt", sleeve: "long", fab: "basin", placket: "white" }, bottom: { type: "trousers", rise: 1.03, fab: "charcoal" } },
];

// ---------- women's bodies: the same clothes on different numbers ----------
const CROP = (a: Garment["fab"], bottom: Garment["fab"]): { top: Garment; bottom: Garment } => ({
  top: { type: "crop", hem: 1.165, neck: "strapless", straps: true, fab: a }, bottom: { type: "skirt", rise: 1.0, hem: 0.74, fab: bottom },
});
// Each body test wears its own outfit and carries one thing, so no two read as the same person.
const DRESS = (fab: Garment["fab"]): { top: Garment; bottom: Garment } => ({ top: { type: "dress", neck: "strapless", fab }, bottom: { type: "skirt", rise: 1.05, hem: 0.7, fab } });
export const VARIETY: PersonSpec[] = [
  { name: "chr_body_slim-short", face: "var_slim_short", body: "fx", size: -0.8, shape: 0.3, height: 0.94, skin: "skin6", hair: "bun", heels: true, shoes: "black", bag: "red",
    patterns: [{ kind: "adire", seed: 3 }], ...CROP(1, "black") },
  { name: "chr_body_regular", face: "var_regular", body: "fx", shape: 0.5, skin: "skin4", hair: "long", heels: true, shoes: "gold",
    patterns: [{ kind: "ankara", seed: 6, cols: ["wine", "gold", "cream", "orange"] }], ...DRESS(1) },
  { name: "chr_body_busty", face: "var_busty", body: "fx", shape: 0.6, bust: 1, skin: "skin3", hair: "braids", hairLen: 1.0, heels: true, shoes: "black", phone: true, ...CROP("orange", "black") },
  { name: "chr_body_tall-eight", face: "var_tall_eight", body: "fx", shape: 0.85, bust: 0.6, height: 1.06, skin: "skin5", hair: "long", heels: true, shoes: "cream", bag: "cream", bagHand: "R", ...DRESS("teal") },
  { name: "chr_body_plus", face: "var_plus", body: "fx", size: 0.8, shape: 0.5, bust: 0.6, skin: "skin2", hair: "afro", heels: true, shoes: "gold", bag: "gold", bagHand: "R",
    patterns: [{ kind: "ankara", seed: 2, cols: ["green", "gold", "cream", "orange"] }],
    top: { type: "blouse", sleeve: "half", hem: 0.96, ease: 0.016, fab: 1 }, bottom: { type: "skirt", rise: 1.0, hem: 0.5, fab: "indigo" } },
  { name: "chr_body_plus-short-busty", face: "var_plus_short_busty", body: "fx", size: 1, shape: 0.7, bust: 1, height: 0.94, skin: "skin5", hair: "long", heels: true, shoes: "black", bag: "black", ...DRESS("green") },
  { name: "chr_body_plus-set", face: "var_plus_set", body: "fx", size: 0.9, shape: 0.4, bust: 0.8, skin: "skin7", hair: "bun", heels: true, shoes: "cream",
    patterns: [{ kind: "ankara", seed: 8, cols: ["orange", "indigo", "cream", "gold"] }],
    top: { type: "crop", hem: 1.15, sleeve: "short", fab: 1 }, bottom: { type: "trousers", rise: 1.1, wide: 0.05, fab: 1 } },
];

// ---------- people of the street ----------
export const STREET: PersonSpec[] = [
  // One pattern a person (assets:flat-and-smooth-shading), so the head scarf matches the wrapper, as a market set often does.
  { name: "chr_iya", body: "fx", size: 0.75, shape: 0.4, bust: 0.7, skin: "skin3", head: "scarf", headFab: 1, shoes: "darkWood",
    patterns: [{ kind: "ankara", seed: 1, cols: ["green", "cream", "red", "danfoYellow"] }],
    top: { type: "blouse", sleeve: "half", hem: 0.96, ease: 0.016, fab: 1 }, bottom: { type: "iro", rise: 1.05, hem: 0.12, flare: -0.02, fab: 1, stride: 0.45 } },
  { name: "chr_hawker_a", body: "fx", shape: 0.3, height: 0.96, skin: "skin4", head: "scarf", headFab: "pepper", shoes: "darkWood", carry: { kind: "oranges", tray: "hub" },
    top: { type: "tee", sleeve: "short", hem: 0.96, ease: 0.014, fab: "white" }, bottom: { type: "iro", rise: 1.05, hem: 0.42, flare: -0.01, fab: "red", stride: 0.7 } },
  { name: "chr_hawker_b", body: "mx", mass: -0.7, height: 0.97, skin: "skin2", head: "cap", headFab: "red", shoes: "white", carry: { kind: "drinks", tray: "basin" }, holding: "orange",
    top: { type: "tee", sleeve: "short", hem: 0.92, ease: 0.016, fab: "danfoYellow" }, bottom: { type: "trousers", shorts: true, fab: "denim" } },
  { name: "chr_hawker_c", body: "fx", size: 0.3, shape: 0.4, skin: "skin5", hair: "cornrows", shoes: "darkWood", carry: { kind: "bread", tray: "wood" },
    patterns: [{ kind: "adire", seed: 5 }], top: { type: "tee", sleeve: "short", hem: 0.96, ease: 0.014, fab: "orange" }, bottom: { type: "iro", rise: 1.05, hem: 0.4, flare: -0.01, fab: 1, stride: 0.7 } },
  { name: "chr_rider", body: "mx", mass: -0.2, skin: "skin3", head: "helmet", headFab: "danfoYellow", shoes: "black",
    top: { type: "jacket", sleeve: "long", hem: 0.92, ease: 0.02, fab: "denim" }, bottom: { type: "trousers", ease: 0.012, fab: "charcoal" } },
];

export const ALL_PEOPLE: PersonSpec[] = [...PEOPLE, ...MODERN, ...MEN, ...VARIETY, ...STREET];
