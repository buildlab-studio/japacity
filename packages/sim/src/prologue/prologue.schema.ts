import { z } from "zod";

import { BpSchema, CountSchema, EffectSchema, IntSchema, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { PrologueStep } from "../engine/types";

export const PrologueStepSchema = z.strictObject({
  id: z.string().min(1),
  months: CountSchema,
  next: z.string().min(1).nullable(),
  answers: z.array(
    z.strictObject({
      id: z.string().min(1),
      requires: z.array(RequirementSchema),
      effects: z.array(EffectSchema),
      flags: z.array(z.string().min(1)),
      gradeBase: IntSchema,
      next: z.string().min(1).nullable(),
      draw: z
        .array(z.strictObject({ id: z.string().min(1), bp: BpSchema, effects: z.array(EffectSchema), next: z.string().min(1).nullable() }))
        .nullable(),
    }),
  ),
});

export type PrologueStepMatches = Proof<Same<z.infer<typeof PrologueStepSchema>, PrologueStep>>;
