import { z } from "zod";

import {
  BpSchema,
  CountSchema,
  CurrencySchema,
  EffectSchema,
  idOf,
  type Proof,
  ReasonSchema,
  type Same,
} from "../engine/language.schema";
import type { ObligationEntry } from "../engine/types";

export const ObligationEntrySchema = z.strictObject({
  id: idOf("obligation"),
  type: z.enum(["upkeep", "support", "loan", "held-funds"]),
  currency: CurrencySchema,
  amount: CountSchema,
  rateBp: BpSchema,
  term: z.int().positive().nullable(),
  locksPrincipal: z.boolean(),
  sink: ReasonSchema,
  interestSink: ReasonSchema,
  grace: CountSchema,
  onMiss: z.array(EffectSchema),
  onDefault: z.array(EffectSchema),
});

export type ObligationEntryMatches = Proof<Same<z.infer<typeof ObligationEntrySchema>, ObligationEntry>>;
