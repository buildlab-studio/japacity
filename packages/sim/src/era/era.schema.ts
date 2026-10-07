import { z } from "zod";

import { CountSchema, idOf, type Proof, RangeSchema, type Same } from "../engine/language.schema";
import type { EraEntry } from "../engine/types";

export const EraEntrySchema = z.strictObject({
  id: idOf("era"),
  ticks: RangeSchema,
  weights: z.record(z.string().min(1), CountSchema),
  after: z.record(z.string().min(1), CountSchema),
  once: z.boolean(),
  story: idOf("news"),
});

export type EraEntryMatches = Proof<Same<z.infer<typeof EraEntrySchema>, EraEntry>>;
