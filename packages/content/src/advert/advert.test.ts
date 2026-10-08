import type { AdvertSlotEntry, Content, Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { advertChecks } from "./advert.check";
import { PHONE } from "./advert.data";

function withSlots(slots: AdvertSlotEntry[], tuning: Partial<Content["tuning"]["advert"]> = {}): Content {
  return {
    ...content,
    advert: Object.fromEntries(slots.map((slot) => [slot.id, slot])),
    tuning: { ...content.tuning, advert: { ...content.tuning.advert, ...tuning } },
  };
}

function slot(id: string, place: string, surface: AdvertSlotEntry["surface"] = "billboard"): AdvertSlotEntry {
  return { id: id as Id<"advert">, surface, place, width: 1024, height: 512, maxBytes: 1000 };
}

const KIB = 1024;

describe("the advert slots", () => {
  test("[R-ADVERT-001] given the page's entries, when the table is read, then each slot at launch has its surface, place, size and byte limit", () => {
    expect(Object.values(content.advert).map(({ id, surface, width, height, maxBytes }) => [id, surface, width, height, maxBytes])).toEqual([
      ["advert.road-billboard", "billboard", 1024, 512, 200 * KIB],
      ["advert.park-billboard", "billboard", 1024, 512, 200 * KIB],
      ["advert.airport-poster", "poster", 512, 768, 150 * KIB],
      ["advert.arrivals-poster", "poster", 512, 768, 150 * KIB],
      ["advert.phone-tile", "phone-tile", 256, 256, 50 * KIB],
      ["advert.food-spot", "shopfront", 768, 192, 100 * KIB],
    ]);
    expect(content.place["place.heathrow"]?.where).toBe("abroad");
    expect(content.place["place.airport-lagos"]?.where).toBe("home");
  });

  test("[R-ADVERT-001] given the content, when the advert check runs, then it finds nothing, and every word the slots show exists", () => {
    expect(advertChecks(content)).toEqual([]);
    for (const key of ["advert.label", "advert.empty", "advert.card.note", "advert.card.leaving.title", "advert.card.leaving.body"]) expect(text[key]?.trim()).toBeTruthy();
  });

  test("[R-ADVERT-001] given a slot at a place that does not exist, or filed under another id, when the check runs, then it says so", () => {
    expect(advertChecks(withSlots([slot("advert.nowhere", "place.nowhere")]))).toEqual(["advert.nowhere: stands at place.nowhere, which is not a place (R-ADVERT-001)."]);
    const misfiled = { ...content, advert: { "advert.one": slot("advert.two", "place.yaba") } } as Content;
    expect(advertChecks(misfiled)).toEqual(["advert: the entry under advert.one has the id advert.two (R-ADVERT-001)."]);
  });

  test("[R-ADVERT-002] given a place with exactly the most slots allowed, when one more is added, then the check fails that place", () => {
    const most = content.tuning.advert.maxSlotsPerPlace;
    const slots = Array.from({ length: most }, (_, index) => slot(`advert.yaba-${String(index)}`, "place.yaba"));
    expect(advertChecks(withSlots(slots))).toEqual([]);
    expect(advertChecks(withSlots([...slots, slot("advert.yaba-more", "place.yaba")]))).toEqual([`place.yaba: has ${String(most + 1)} advert slots, over ${String(most)} (R-ADVERT-002).`]);
  });

  test("[R-ADVERT-002] given the phone's grid with the most sponsored tiles allowed, when one more is added, then the check fails the phone", () => {
    const most = content.tuning.advert.maxPhoneTiles;
    const tiles = Array.from({ length: most }, (_, index) => slot(`advert.tile-${String(index)}`, PHONE, "phone-tile"));
    expect(advertChecks(withSlots(tiles))).toEqual([]);
    expect(advertChecks(withSlots([...tiles, slot("advert.tile-more", PHONE, "phone-tile")]))).toEqual([`phone: has ${String(most + 1)} sponsored tiles, over ${String(most)} (R-ADVERT-002).`]);
    expect(advertChecks(withSlots([slot("advert.tile-at-yaba", "place.yaba", "phone-tile")]))).toHaveLength(1);
  });

  test("[R-ADVERT-002] given a slot at a stylised place, on the road, or at an institution, when the check runs, then each is refused", () => {
    expect(advertChecks(withSlots([slot("advert.park", "place.motor-park")]))).toEqual(["advert.park: stands at the stylised place place.motor-park (R-CITY-023)."]);
    expect(advertChecks(withSlots([slot("advert.night", "place.road-night")]))).toEqual([
      "advert.night: stands on the road at place.road-night (R-CITY-023).",
      "advert.night: stands at the stylised place place.road-night (R-CITY-023).",
    ]);
    expect(advertChecks(withSlots([slot("advert.visa", "place.visa-centre")]))).toEqual(["advert.visa: stands at the institution place.visa-centre (R-ADVERT-019)."]);
  });
});

describe("where adverts never go", () => {
  test("[R-ADVERT-009] given the slots at launch, when their surfaces are read, then each is a billboard, a poster, a phone tile or a shopfront, and none is on the radio", () => {
    const surfaces = new Set(Object.values(content.advert).map((entry) => entry.surface));
    expect([...surfaces].sort()).toEqual(["billboard", "phone-tile", "poster", "shopfront"]);
    expect(Object.keys(content.advert).filter((id) => /radio|news/.test(id))).toEqual([]);
  });
});
