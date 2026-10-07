import { z } from "zod";

import {
  BpSchema,
  CountSchema,
  idOf,
  type Proof,
  RangeSchema,
  RequirementSchema,
  RouteGateSchema,
  type Same,
} from "../engine/language.schema";
import type { ChecklistItem, PointsEntry, RouteEntry } from "../engine/types";

export const ChecklistItemSchema = z.strictObject({
  id: z.string().min(1),
  weight: CountSchema,
  requirement: RequirementSchema,
  partial: z.boolean(),
});

export const RouteEntrySchema = z.strictObject({
  id: idOf("route"),
  gate: RouteGateSchema,
  country: idOf("country").nullable(),
  status: idOf("status").nullable(),
  refusalBaseBp: BpSchema,
  flightPaidByEmployer: z.boolean(),
  hearIf: z.array(RequirementSchema),
  hearBy: CountSchema.nullable(),
  window: idOf("var").nullable(),
  // The road has no checklist (R-ROAD-001); every other route has at least one item.
  checklist: z.array(ChecklistItemSchema),
  schools: z.array(idOf("school")),
  interview: idOf("setpiece").nullable(),
  sponsor: z
    .strictObject({
      salaryVar: idOf("var"),
      maintenanceVar: idOf("var").nullable(),
      findBp: BpSchema,
      bandMin: CountSchema,
      documents: z.array(idOf("document")),
    })
    .exactOptional(),
  points: z
    .strictObject({
      table: idOf("points"),
      fundsVar: idOf("var"),
      cutoffVar: idOf("var"),
      careCutoffVar: idOf("var").nullable(),
      feeVar: idOf("var"),
      decisionVar: idOf("var"),
      profileMonths: CountSchema,
    })
    .exactOptional(),
  endorsement: z
    .strictObject({
      document: idOf("document"),
      baseBp: BpSchema,
      perPortfolioBp: BpSchema,
      perNetworkBp: BpSchema,
      capBp: BpSchema,
      cooldown: CountSchema,
      feeVar: idOf("var"),
    })
    .exactOptional(),
  contract: z.strictObject({ medical: idOf("document"), maxAgeMonths: CountSchema }).exactOptional(),
  road: z
    .strictObject({
      steps: z.array(
        z.strictObject({ id: z.string().min(1), months: RangeSchema, on: BpSchema, held: BpSchema, turned: BpSchema, lost: BpSchema }),
      ),
    })
    .exactOptional(),
});

export const PointsEntrySchema = z.strictObject({
  id: idOf("points"),
  age: z.array(z.strictObject({ years: CountSchema, points: CountSchema })),
  education: z.array(z.strictObject({ level: CountSchema, points: CountSchema })),
  language: z.array(z.strictObject({ band: CountSchema, points: CountSchema })),
  transfer: z.strictObject({
    educationLowBand: CountSchema,
    educationHighBand: CountSchema,
    workLowBand: CountSchema,
    workHighBand: CountSchema,
    workLongLowBand: CountSchema,
    workLongHighBand: CountSchema,
    highBand: CountSchema,
    longMonths: CountSchema,
    cap: CountSchema,
  }),
});

export type ChecklistItemMatches = Proof<Same<z.infer<typeof ChecklistItemSchema>, ChecklistItem>>;
export type RouteEntryMatches = Proof<Same<z.infer<typeof RouteEntrySchema>, RouteEntry>>;
export type PointsEntryMatches = Proof<Same<z.infer<typeof PointsEntrySchema>, PointsEntry>>;
