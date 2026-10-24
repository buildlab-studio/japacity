import { z } from "zod";

import {
  BpSchema,
  CountSchema,
  CurrencySchema,
  EffectSchema,
  idOf,
  ObligationTypeSchema,
  type Proof,
  ReasonSchema,
  type Same,
  WhereEntrySchema,
} from "../engine/language.schema";
import type { ObligationEntry } from "../engine/types";

export const ObligationEntrySchema = z.strictObject({
  id: idOf("obligation"),
  type: ObligationTypeSchema,
  where: WhereEntrySchema.exactOptional(),
  currency: CurrencySchema,
  everyMonths: z.int().positive().exactOptional(),
  prepaid: z.boolean().exactOptional(),
  creditMin: CountSchema.exactOptional(),
  reportsToCredit: z.boolean().exactOptional(),
  deposit: CountSchema.exactOptional(),
  rateByCredit: z.array(z.strictObject({ min: CountSchema, rateBp: BpSchema })).exactOptional(),
  car: z
    .strictObject({
      price: CountSchema,
      depositBp: BpSchema,
      finalBp: BpSchema,
      resaleBp: BpSchema,
      courtThirdBp: BpSchema,
      handBackBp: BpSchema,
      courtMonths: CountSchema,
      shortfall: idOf("obligation"),
    })
    .exactOptional(),
  seize: z.array(EffectSchema).exactOptional(),
  amount: CountSchema,
  rateBp: BpSchema,
  term: z.int().positive().nullable(),
  sink: ReasonSchema,
  interestSink: ReasonSchema,
  grace: CountSchema,
  onMiss: z.array(EffectSchema),
  onDefault: z.array(EffectSchema),
  schedule: z.array(BpSchema).min(1).exactOptional(),
  onCut: z.array(EffectSchema).exactOptional(),
});

export type ObligationEntryMatches = Proof<Same<z.infer<typeof ObligationEntrySchema>, ObligationEntry>>;
