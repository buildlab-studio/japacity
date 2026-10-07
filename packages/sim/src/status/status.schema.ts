import { z } from "zod";

import { BpSchema, CountSchema, idOf, type Proof, RequirementSchema, type Same, WorkRuleSchema } from "../engine/language.schema";
import type { StatusEntry } from "../engine/types";

export const StatusEntrySchema = z.strictObject({
  id: idOf("status"),
  country: idOf("country"),
  months: z.union([CountSchema, idOf("var")]).nullable(),
  work: WorkRuleSchema,
  clockMonths: CountSchema.nullable(),
  lapsesAtOnce: z.boolean(),
  renewMonths: CountSchema,
  renewFeeVar: idOf("var").nullable(),
  surchargeYearVar: idOf("var").nullable(),
  next: idOf("status").nullable(),
  nextIf: z.array(RequirementSchema),
  countsToSettlement: z.boolean(),
  countsFromBefore: z.boolean(),
  settleMonthsVar: idOf("var").nullable(),
  settleFeeVar: idOf("var").nullable(),
  settled: idOf("status").nullable(),
  citizenAfter: CountSchema.nullable(),
  citizenFeeVar: idOf("var").nullable(),
  citizen: idOf("status").nullable(),
  banMonths: CountSchema,
  overstayBanMonths: CountSchema,
  detectBp: BpSchema,
  holdsPassport: z.boolean(),
});

export type StatusEntryMatches = Proof<Same<z.infer<typeof StatusEntrySchema>, StatusEntry>>;
