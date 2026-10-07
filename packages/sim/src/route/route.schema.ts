import { z } from "zod";

import { CountSchema, idOf, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { ChecklistItem, RouteEntry } from "../engine/types";

export const ChecklistItemSchema = z.strictObject({
  id: z.string().min(1),
  weight: CountSchema,
  requirement: RequirementSchema,
  partial: z.boolean(),
});

export const RouteEntrySchema = z.strictObject({
  id: idOf("route"),
  hearIf: z.array(RequirementSchema),
  hearBy: CountSchema,
  window: idOf("var"),
  checklist: z.array(ChecklistItemSchema).min(1),
  schools: z.array(idOf("school")),
  interview: idOf("setpiece"),
});

export type ChecklistItemMatches = Proof<Same<z.infer<typeof ChecklistItemSchema>, ChecklistItem>>;
export type RouteEntryMatches = Proof<Same<z.infer<typeof RouteEntrySchema>, RouteEntry>>;
