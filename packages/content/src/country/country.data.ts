// From docs/rules/place.md "Entries: countries" and abroad-money.md "Entries". Only
// what the UK master's route needs is here; the whole-life content work adds the rest.
import type { CountryEntry, Id } from "@japacity/sim";

import { pounds } from "../units";

export const countryTable: Record<Id<"country">, CountryEntry> = {
  "country.uk": {
    id: "country.uk",
    currency: "GBP",
    // One way, off peak (place.md). December factor 2.5.
    fare: pounds(620),
    decemberFactorBp: 25000,
    // 2026/27: personal allowance, basic rate plus employee national insurance.
    taxFreeLine: pounds(12570),
    taxBp: 2800,
    upkeep: null,
    rentRoom: null,
    rentFlat: null,
    phone: null,
    overstayer: null,
    deceptionBanMonths: 120,
  },
};
