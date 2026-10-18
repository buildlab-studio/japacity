import type { Id } from "@japacity/sim";
import { CountryEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content } from "../index";

const countries = Object.values(content.country);

describe("countries", () => {
  test("[engine:content-checked-before-play] given every country, when it is checked against its schema, then it parses and its key is its id", () => {
    expect(countries.map((country) => country.id)).toEqual(["country.uk", "country.canada", "country.uae", "country.italy"]);
    for (const [key, country] of Object.entries(content.country)) {
      expect(CountryEntrySchema.safeParse(country).error?.issues ?? []).toEqual([]);
      expect(country.id).toBe(key);
    }
  });

  test("[engine:content-checked-before-play] given every country, when the obligations it names are looked up, then each exists, applies abroad and charges in the country's currency", () => {
    const problems = countries.flatMap((country) => {
      const named: [string, Id<"obligation"> | null][] = [
        ["upkeep", country.upkeep],
        ["rentRoom", country.rentRoom],
        ["rentFlat", country.rentFlat],
        ["phone", country.phone],
      ];
      return named.flatMap(([field, id]) => {
        if (id === null) return [];
        const entry = content.obligation[id];
        if (entry === undefined) return [`${country.id} ${field} names ${id}, which does not exist`];
        const wrong: string[] = [];
        if (entry.where !== "abroad") wrong.push(`${id} has where ${String(entry.where)}`);
        if (entry.currency !== country.currency) wrong.push(`${id} charges ${entry.currency}, not ${country.currency}`);
        return wrong;
      });
    });
    expect(problems).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every country, when its upkeep, room and overstayer are read, then each has one and the obligations have the right types", () => {
    for (const country of countries) {
      expect(country.upkeep).not.toBeNull();
      expect(country.rentRoom).not.toBeNull();
      expect(content.obligation[country.upkeep!]?.type).toBe("upkeep");
      expect(content.obligation[country.rentRoom!]?.type).toBe("rent");
      expect(country.rentFlat === null ? "rent" : content.obligation[country.rentFlat]?.type).toBe("rent");
      expect(country.phone === null ? "phone" : content.obligation[country.phone]?.type).toBe("phone");
      // status:overstayer-risks-detection: the overstayer status of the country allows cash work only and does not expire.
      const overstayer = content.status[country.overstayer!];
      expect(overstayer?.country).toBe(country.id);
      expect(overstayer?.work).toBe("cash");
      expect(overstayer?.months).toBeNull();
    }
  });

  test("[engine:content-checked-before-play] given the countries, when figures from place.md and abroad-money.md are read back, then each matches the page", () => {
    const uk = content.country["country.uk"];
    // place.md: £620 one way, a December factor of 2.5.
    expect(uk?.fare).toBe(62000);
    expect(uk?.decemberFactorBp).toBe(25000);
    // abroad-money.md: the personal allowance of £12,570 and 20% plus 8% above it.
    expect(uk?.taxFreeLine).toBe(1257000);
    expect(uk?.taxBp).toBe(2800);
    expect(uk?.deceptionBanMonths).toBe(120);
    // Canada: C$1,350, 2.2, 25% above C$16,000.
    expect(content.country["country.canada"]).toMatchObject({ currency: "CAD", fare: 135000, decemberFactorBp: 22000, taxFreeLine: 1600000, taxBp: 2500 });
    // UAE: AED 1,900, 1.8, no tax.
    expect(content.country["country.uae"]).toMatchObject({ currency: "AED", fare: 190000, decemberFactorBp: 18000, taxBp: 0, rentFlat: null });
    // Italy: €480, 2.0.
    expect(content.country["country.italy"]).toMatchObject({ currency: "EUR", fare: 48000, decemberFactorBp: 20000 });
  });
});
