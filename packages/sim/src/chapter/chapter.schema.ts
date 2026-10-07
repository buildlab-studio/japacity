import { z } from "zod";

import { idOf, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { ChapterEntry } from "../engine/types";

export const ChapterEntrySchema = z.strictObject({
  id: idOf("chapter"),
  order: z.int().positive(),
  items: z.array(z.strictObject({ id: z.string().min(1), requirement: RequirementSchema })).min(1),
});

export type ChapterEntryMatches = Proof<Same<z.infer<typeof ChapterEntrySchema>, ChapterEntry>>;
