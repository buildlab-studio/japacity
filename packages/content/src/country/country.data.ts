// From docs/rules/place.md "Entries: countries", abroad-money.md "Entries" and
// status.md "Entries". Fares are one way, off peak, in the country's smallest unit.
import type { CountryEntry, Id } from "@japacity/sim";

import { aed, cad, euros, pounds } from "../units";

export const countryTable: Record<Id<"country">, CountryEntry> = {
  "country.uk": {
    id: "country.uk",
    currency: "GBP",
    fare: pounds(620),
    // 2.5, in basis points.
    decemberFactorBp: 25000,
    // 2026/27: personal allowance, basic rate plus employee national insurance.
    taxFreeLine: pounds(12570),
    taxBp: 2800,
    upkeep: "obligation.upkeep-uk",
    rentRoom: "obligation.rent-room-uk",
    rentFlat: "obligation.rent-flat-uk",
    phone: "obligation.phone-uk",
    overstayer: "status.uk-overstayer",
    deceptionBanMonths: 120,
    partnerBarMonths: 0,
    // The room abroad's made-up spot on the painted map, off Choumert Road in Peckham (design page 14 section 4).
    homeSpot: { latE3: 51471, lonE3: -73 },
  },
  "country.canada": {
    id: "country.canada",
    currency: "CAD",
    fare: cad(1350),
    // 2.2
    decemberFactorBp: 22000,
    // A flat working band: 25% above C$16,000.
    taxFreeLine: cad(16000),
    taxBp: 2500,
    upkeep: "obligation.upkeep-ca",
    rentRoom: "obligation.rent-room-ca",
    rentFlat: "obligation.rent-flat-ca",
    phone: "obligation.phone-ca",
    overstayer: "status.ca-overstayer",
    // no Canadian gate refuses for deception (R-GATE-005 names the sponsor
    // and contract gates only), so the page gives no ban and there is none.
    // R-INTERVIEW: five years after misrepresentation (IRPA s. 40); R-UNDERTAKING-004: five years after arriving through a partner (IRPR s. 130(3)).
    deceptionBanMonths: 60,
    partnerBarMonths: 60,
    // The room abroad's made-up spot on the painted map, in the north-east (design page 15 section 3).
    homeSpot: { latE3: 51088, lonE3: -113955 },
  },
  "country.uae": {
    id: "country.uae",
    currency: "AED",
    fare: aed(1900),
    // 1.8
    decemberFactorBp: 18000,
    // No income tax.
    taxFreeLine: 0,
    taxBp: 0,
    upkeep: "obligation.upkeep-uae",
    rentRoom: "obligation.rent-room-uae",
    rentFlat: null,
    phone: null,
    overstayer: "status.uae-irregular",
    // R-CONTRACT-003: R-GATE-005 does not apply to a fraud agent; nothing was forged in your name.
    deceptionBanMonths: 0,
    partnerBarMonths: 0,
    // The room abroad's made-up spot on the painted map, the camp, east of the city (design page 15 section 3).
    homeSpot: { latE3: 25270, lonE3: 55395 },
  },
  "country.italy": {
    id: "country.italy",
    currency: "EUR",
    fare: euros(480),
    // 2.0
    decemberFactorBp: 20000,
    // cash work only in this milestone, and cash work is untaxed (R-LADDER-003),
    // so the page gives Italy no tax line and none is entered.
    taxFreeLine: 0,
    taxBp: 0,
    upkeep: "obligation.upkeep-it",
    rentRoom: "obligation.rent-room-it",
    rentFlat: null,
    phone: null,
    overstayer: "status.eu-irregular",
    // The road has no fraud refusal of its own.
    deceptionBanMonths: 0,
    partnerBarMonths: 0,
    // The room abroad's made-up spot on the painted map, on the Domitiana (design page 15 section 3).
    homeSpot: { latE3: 40950, lonE3: 14010 },
  },
};
