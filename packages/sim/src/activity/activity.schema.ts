import { z } from "zod";

import {
  BpSchema,
  CostSchema,
  CountSchema,
  EffectSchema,
  idOf,
  MoneySchema,
  type Proof,
  RequirementSchema,
  type Same,
  WhereEntrySchema,
} from "../engine/language.schema";
import type { ActivityEntry } from "../engine/types";

export const ActivityEntrySchema = z.strictObject({
  id: idOf("activity"),
  slot: z.enum(["main", "free", "side"]),
  sickLeave: z.boolean().exactOptional(),
  where: WhereEntrySchema.exactOptional(),
  country: idOf("country").nullable().exactOptional(),
  part: z.boolean().exactOptional(),
  cash: z.boolean().exactOptional(),
  withheldBp: BpSchema.exactOptional(),
  sponsor: z.boolean().exactOptional(),
  needsCar: z.boolean().exactOptional(),
  carBonus: CountSchema.exactOptional(),
  requires: z.array(RequirementSchema),
  param: z.enum(["job", "route", "school"]).nullable(),
  cost: z.array(CostSchema),
  pay: MoneySchema.nullable(),
  hireBp: BpSchema.nullable(),
  effects: z.array(EffectSchema),
  counts: z.array(idOf("route")),
});

export type ActivityEntryMatches = Proof<Same<z.infer<typeof ActivityEntrySchema>, ActivityEntry>>;
