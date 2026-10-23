import { z } from "zod";

import { BpSchema, CountSchema, idOf, type Proof, RangeSchema, type Same } from "../engine/language.schema";
import type { SchoolEntry } from "../engine/types";

export const SchoolEntrySchema = z.strictObject({
  id: idOf("school"),
  route: idOf("route"),
  tuition: CountSchema,
  deposit: CountSchema,
  minGrade: CountSchema,
  offerBp: BpSchema,
  autoDiscount: z.strictObject({ minGrade: CountSchema, amount: CountSchema }).nullable(),
  meritDiscount: z.strictObject({ bp: BpSchema, amount: CountSchema }).nullable(),
  answerMonths: RangeSchema,
});

export type SchoolEntryMatches = Proof<Same<z.infer<typeof SchoolEntrySchema>, SchoolEntry>>;
