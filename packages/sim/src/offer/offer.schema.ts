import { z } from "zod";

import {
  BpSchema,
  CountSchema,
  EffectSchema,
  idOf,
  type Proof,
  RequirementSchema,
  type Same,
  TermSpecSchema,
  WhereEntrySchema,
} from "../engine/language.schema";
import type { OfferChoice, OfferEntry } from "../engine/types";

export const OfferChoiceSchema = z.strictObject({
  id: z.string().min(1),
  requires: z.array(RequirementSchema),
  pick: z.strictObject({ minTerm: z.string().min(1), maxTerm: z.string().min(1) }).nullable(),
  effects: z.array(EffectSchema),
  fraudEffects: z.array(EffectSchema).nullable(),
});

export const OfferEntrySchema = z.strictObject({
  id: idOf("offer"),
  group: z.enum(["family", "job", "money", "life", "road", "abroad", "return"]),
  where: WhereEntrySchema.exactOptional(),
  pressure: z
    .strictObject({
      refusalBp: BpSchema,
      defaultBp: BpSchema,
      lowStandingBp: BpSchema,
      perYearOver30Bp: BpSchema,
      strongRouteBp: BpSchema,
    })
    .exactOptional(),
  kinds: z.strictObject({ fraud: BpSchema, realish: BpSchema, road: BpSchema }).exactOptional(),
  luck: z.boolean().exactOptional(),
  bad: z.boolean().exactOptional(),
  lockNext: z.strictObject({ slots: CountSchema, months: z.int().positive(), why: z.string().min(1) }).exactOptional(),
  news: z.boolean().exactOptional(),
  when: z.array(RequirementSchema),
  chanceBp: BpSchema,
  cooldown: CountSchema,
  maxTimes: z.int().positive().nullable(),
  expiresAfter: z.int().positive(),
  terms: z.record(z.string().min(1), TermSpecSchema),
  fraudBp: BpSchema,
  signs: z.array(z.strictObject({ key: z.string().min(1), honestBp: BpSchema, fraudBp: BpSchema })),
  choices: z.array(OfferChoiceSchema).min(1),
  onExpire: z.string().min(1).nullable(),
});

export type OfferChoiceMatches = Proof<Same<z.infer<typeof OfferChoiceSchema>, OfferChoice>>;
export type OfferEntryMatches = Proof<Same<z.infer<typeof OfferEntrySchema>, OfferEntry>>;
