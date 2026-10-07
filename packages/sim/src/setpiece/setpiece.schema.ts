import { z } from "zod";

import { EffectSchema, idOf, IntSchema, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { SetpieceAnswer, SetpieceEntry, SetpieceQuestion } from "../engine/types";

export const SetpieceAnswerSchema = z.strictObject({
  id: z.string().min(1),
  score: IntSchema,
  when: z.array(RequirementSchema),
  thenScore: IntSchema.nullable(),
  effects: z.array(EffectSchema),
});

export const SetpieceQuestionSchema = z.strictObject({
  id: z.string().min(1),
  when: z.array(RequirementSchema),
  answers: z.array(SetpieceAnswerSchema).min(1),
});

export const SetpieceEntrySchema = z.strictObject({
  id: idOf("setpiece"),
  ask: z.int().positive(),
  questions: z.array(SetpieceQuestionSchema).min(1),
});

export type SetpieceAnswerMatches = Proof<Same<z.infer<typeof SetpieceAnswerSchema>, SetpieceAnswer>>;
export type SetpieceQuestionMatches = Proof<Same<z.infer<typeof SetpieceQuestionSchema>, SetpieceQuestion>>;
export type SetpieceEntryMatches = Proof<Same<z.infer<typeof SetpieceEntrySchema>, SetpieceEntry>>;
