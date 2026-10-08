import { z } from "zod";

import { BpSchema, CountSchema, CurrencySchema, idOf, type Proof, type Same } from "../engine/language.schema";
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
});

export type CountryEntryMatches = Proof<Same<z.infer<typeof CountryEntrySchema>, CountryEntry>>;
