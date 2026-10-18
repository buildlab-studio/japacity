// What the door's pictures stand for (prologue:front-door-three-screens): each life's own
// thing on its card, from the game's own models, in the soft tint of its kind; each way a tile opens as a picture chip;
// and each home's picture, the room as the game draws it, or a model's tile where the home has no room to show.
import type { Tint } from "../ui/lively/tint";
import type { ArchetypeId, Home } from "./archetypes";

/** A life's thing: the model whose tile stands big on the life's card, and the card's tint. */
export const LIFE_THINGS: Readonly<Record<ArchetypeId, { tile: string; tint: Tint }>> = {
  developer: { tile: "prop_laptop-desk", tint: "study" },
  nurse: { tile: "prop_xray-stand", tint: "body" },
  accountant: { tile: "prop_office-desk", tint: "money" },
  writer: { tile: "prop_radio", tint: "people" },
  trader: { tile: "prop_market-stall", tint: "food" },
  "shop-worker": { tile: "shop_provisions", tint: "plain" },
  water: { tile: "prop_fish-racks", tint: "study" },
};

/**
 * The picture for a way a tile opens, from its words ("Tech work in the UK", "A master's", "The road through the desert
 * to Europe"): the id whose tile the picture table holds for it. A way with no picture of its own takes none.
 */
export function wayPicture(words: string): string | null {
  if (/master/i.test(words)) return "activity.masters-at-home";
  if (/\bUK\b/.test(words)) return "route.uk-skilled";
  if (/Canada/.test(words)) return "route.canada-points";
  if (/Gulf/.test(words)) return "route.gulf-contract";
  if (/road|desert/i.test(words)) return "route.road";
  return null;
}

const PICTURES = import.meta.glob<string>("./homes/*.webp", { eager: true, query: "?url", import: "default" });

/**
 * A home's picture: the room as the game draws it (cropped from the wide homes' renders) for the three homes on the
 * mainland, else the model the picture table names for the place (Makoko's house on stilts), and for the self-contain,
 * the goal, a Yaba house.
 */
export function homePicture(home: Home | "self-contain"): { src: string } | { model: string } {
  const src = PICTURES[`./homes/${home}.webp`];
  if (src !== undefined) return { src };
  return { model: home === "makoko" ? "bld_makoko-house_b" : "bld_laptop-house" };
}
