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
    route: idOf("route").exactOptional(),
    variantOf: idOf("chapter").exactOptional(),
  })
  .refine((entry) => entry.closesOn === undefined || entry.items.some((item) => item.id === entry.closesOn), {
    error: "closesOn must name one of the chapter's items.",
  })
  // chapter:chapters-follow-lean-route: a variant names both the base it stands in for and the route it is for.
  .refine((entry) => (entry.route === undefined) === (entry.variantOf === undefined), {
    error: "route and variantOf go together.",
  })
  .refine((entry) => entry.variantOf !== entry.id, { error: "A chapter cannot be its own variant." });

export type ChapterEntryMatches = Proof<Same<z.infer<typeof ChapterEntrySchema>, ChapterEntry>>;
