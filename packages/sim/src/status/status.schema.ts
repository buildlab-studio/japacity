import { z } from "zod";

import { BpSchema, CountSchema, idOf, type Proof, RequirementSchema, type Same, WorkRuleSchema } from "../engine/language.schema";
import type { StatusEntry } from "../engine/types";

export const StatusEntrySchema = z.strictObject({
  id: idOf("status"),
  country: idOf("country"),
  months: z.union([CountSchema, idOf("var"), z.literal("lead")]).nullable(),
  work: WorkRuleSchema,
  dependants: z.union([z.literal("none"), z.literal("any"), z.array(idOf("activity"))]),
  tiedTo: z.literal("partner").nullable(),
  clockMonths: CountSchema.nullable(),
  lapsesAtOnce: z.boolean(),
  renewMonths: CountSchema,
  renewBp: BpSchema.exactOptional(),
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
  detectBp: BpSchema,
  holdsPassport: z.boolean(),
  graceMonths: CountSchema.exactOptional(),
  noticeMonths: CountSchema.exactOptional(),
  ownFareBanMonths: CountSchema.exactOptional(),
  assistedBanMonths: CountSchema.exactOptional(),
  rentCheckBp: BpSchema.exactOptional(),
  returnGrant: CountSchema.exactOptional(),
  finePerMonth: CountSchema.exactOptional(),
});

export type StatusEntryMatches = Proof<Same<z.infer<typeof StatusEntrySchema>, StatusEntry>>;
