import { z } from "zod";

import { EffectSchema, idOf, type Proof, RequirementSchema, type Same, WhereEntrySchema } from "../engine/language.schema";
import type { GoalEntry } from "../engine/types";

export const GoalEntrySchema = z.strictObject({
  id: idOf("goal"),
  where: WhereEntrySchema,
  openIf: z.array(RequirementSchema),
  doneIf: z.array(RequirementSchema),
  reward: z.array(EffectSchema),
});

export type GoalEntryMatches = Proof<Same<z.infer<typeof GoalEntrySchema>, GoalEntry>>;
