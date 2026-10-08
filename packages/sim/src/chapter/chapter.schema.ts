import { z } from "zod";

import { idOf, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { ChapterEntry } from "../engine/types";

export const ChapterEntrySchema = z
  .strictObject({
    id: idOf("chapter"),
    order: z.int().positive(),
    items: z.array(z.strictObject({ id: z.string().min(1), requirement: RequirementSchema })).min(1),
    closesOn: z.string().min(1).exactOptional(),
    noAdverts: z.boolean().exactOptional(),
  })
  .refine((entry) => entry.closesOn === undefined || entry.items.some((item) => item.id === entry.closesOn), {
    error: "closesOn must name one of the chapter's items.",
  });

export type ChapterEntryMatches = Proof<Same<z.infer<typeof ChapterEntrySchema>, ChapterEntry>>;
