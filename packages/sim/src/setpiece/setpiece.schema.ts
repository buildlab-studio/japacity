import { z } from "zod";

import { EffectSchema, idOf, IntSchema, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { SetpieceAnswer, SetpieceEntry, SetpieceQuestion } from "../engine/types";

export const SetpieceAnswerSchema = z.strictObject({
  id: z.string().min(1),
  score: IntSchema,
  when: z.array(RequirementSchema),
  thenScore: IntSchema.nullable(),
  effects: z.array(EffectSchema),
  requires: z.array(RequirementSchema).exactOptional(),
  closes: z.literal(true).exactOptional(),
  followUp: z.string().min(1).exactOptional(),
});

export const SetpieceQuestionSchema = z.strictObject({
  id: z.string().min(1),
  when: z.array(RequirementSchema),
  answers: z.array(SetpieceAnswerSchema).min(1),
});

export const SetpieceEntrySchema = z.strictObject({
  id: idOf("setpiece"),
  ask: z.int().positive(),
  order: z.literal("fixed").exactOptional(),
  questions: z.array(SetpieceQuestionSchema).min(1),
  followUps: z.array(SetpieceQuestionSchema).exactOptional(),
});

export type SetpieceAnswerMatches = Proof<Same<z.infer<typeof SetpieceAnswerSchema>, SetpieceAnswer>>;
export type SetpieceQuestionMatches = Proof<Same<z.infer<typeof SetpieceQuestionSchema>, SetpieceQuestion>>;
export type SetpieceEntryMatches = Proof<Same<z.infer<typeof SetpieceEntrySchema>, SetpieceEntry>>;
