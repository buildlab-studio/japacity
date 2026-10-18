// The content check for advert slots (advert:adverts-only-in-slots, advert:slots-capped-per-place, city:road-places-are-stylised).
// The engine's check does not list the advert kind, so this one sees every field.
import type { AdvertSlotEntry, Content } from "@japacity/sim";

import { PHONE } from "./advert.data";

const SLOT_ID = /^advert\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slotProblems(content: Content, key: string, slot: AdvertSlotEntry): string[] {
  const problems: string[] = [];
  if (!SLOT_ID.test(key)) problems.push(`advert: the key ${key} is not a well-formed advert id (advert:adverts-only-in-slots).`);
  if (slot.id !== key) problems.push(`advert: the entry under ${key} has the id ${slot.id} (advert:adverts-only-in-slots).`);
  if (slot.width < 1 || slot.height < 1 || slot.maxBytes < 1) problems.push(`${slot.id}: a size or byte limit under 1 (advert:adverts-only-in-slots).`);
  if (slot.surface === "phone-tile") {
    if (slot.place !== PHONE) problems.push(`${slot.id}: a phone tile stands on the phone, not at ${slot.place} (advert:slots-capped-per-place).`);
    return problems;
  }
  const place = content.place[slot.place as keyof Content["place"]];
  if (place === undefined) {
    problems.push(`${slot.id}: stands at ${slot.place}, which is not a place (advert:adverts-only-in-slots).`);
    return problems;
  }
  if (place.where === "road") problems.push(`${slot.id}: stands on the road at ${place.id} (city:road-places-are-stylised).`);
  if (place.nameKind === "stylised") problems.push(`${slot.id}: stands at the stylised place ${place.id} (city:road-places-are-stylised).`);
  if (place.nameKind === "institution") problems.push(`${slot.id}: stands at the institution ${place.id} (advert:institutions-never-take-real-names).`);
  return problems;
}

/** Sentences describing what is wrong with the slots. Empty when they are sound. */
export function advertChecks(content: Content): string[] {
  const slots = Object.entries(content.advert);
  const problems = slots.flatMap(([key, slot]) => slotProblems(content, key, slot));
  const { maxSlotsPerPlace, maxPhoneTiles } = content.tuning.advert;
  const perPlace = new Map<string, number>();
  for (const [, slot] of slots) {
    if (slot.surface !== "phone-tile") perPlace.set(slot.place, (perPlace.get(slot.place) ?? 0) + 1);
  }
  for (const [place, count] of perPlace) {
    if (count > maxSlotsPerPlace) problems.push(`${place}: has ${String(count)} advert slots, over ${String(maxSlotsPerPlace)} (advert:slots-capped-per-place).`);
  }
  const tiles = slots.filter(([, slot]) => slot.surface === "phone-tile").length;
  if (tiles > maxPhoneTiles) problems.push(`phone: has ${String(tiles)} sponsored tiles, over ${String(maxPhoneTiles)} (advert:slots-capped-per-place).`);
  return problems;
}
