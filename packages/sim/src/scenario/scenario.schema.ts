import { z } from "zod";

import { CountSchema, CurrencySchema, idOf, IntSchema, type Proof, type Same } from "../engine/language.schema";
import type { ScenarioEntry } from "../engine/types";

export const ScenarioEntrySchema = z.strictObject({
  id: idOf("scenario"),
  prologue: z.boolean().exactOptional(),
  qualities: z.record(idOf("quality"), IntSchema),
  job: idOf("activity").nullable(),
  tenure: z.record(idOf("activity"), CountSchema),
  pockets: z.partialRecord(CurrencySchema, z.strictObject({ bank: CountSchema, cash: CountSchema })),
  documents: z.array(
    z.strictObject({
      document: idOf("document"),
      monthsLeft: CountSchema.nullable(),
      value: IntSchema.nullable(),
    }),
  ),
  obligations: z.array(z.strictObject({ obligation: idOf("obligation"), amount: CountSchema })),
});

export type ScenarioEntryMatches = Proof<Same<z.infer<typeof ScenarioEntrySchema>, ScenarioEntry>>;
