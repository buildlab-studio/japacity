import { z } from "zod";

import { BpSchema, CountSchema, CurrencySchema, idOf, IntSchema, type Proof, type Same } from "../engine/language.schema";
import type { CountryEntry } from "../engine/types";

export const CountryEntrySchema = z.strictObject({
  id: idOf("country"),
  currency: CurrencySchema,
  fare: CountSchema,
  decemberFactorBp: CountSchema,
  taxFreeLine: CountSchema,
  taxBp: BpSchema,
  upkeep: idOf("obligation").nullable(),
  rentRoom: idOf("obligation").nullable(),
  rentFlat: idOf("obligation").nullable(),
  phone: idOf("obligation").nullable(),
  overstayer: idOf("status").nullable(),
  deceptionBanMonths: CountSchema,
  partnerBarMonths: CountSchema,
  // The room abroad's spot on the country's painted map (design pages 14 and 15, world:painted-maps-abroad).
  homeSpot: z.strictObject({ latE3: IntSchema, lonE3: IntSchema }).nullable(),
});

export type CountryEntryMatches = Proof<Same<z.infer<typeof CountryEntrySchema>, CountryEntry>>;
