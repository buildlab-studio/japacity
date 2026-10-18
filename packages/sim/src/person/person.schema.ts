import { z } from "zod";

import { BpSchema, CountSchema, idOf, IntSchema, MoneySchema, type Proof, RequirementSchema, type Same } from "../engine/language.schema";
import type { PersonEntry } from "../engine/types";

/** A computer character who can fill a slot: docs/rules/person.md "Entries". */
export const PersonEntrySchema = z.strictObject({
  id: idOf("person"),
  role: z.enum(["partner", "sibling"]),
  weight: CountSchema,
  when: z.array(RequirementSchema),
  profile: z.strictObject({
    ageGapMonths: z.tuple([IntSchema, IntSchema]),
    eduLevel: CountSchema,
    englishBand: CountSchema.nullable(),
    care: CountSchema,
    tech: CountSchema,
    home: z.enum(["city", "town"]),
    job: idOf("activity").nullable(),
    pay: MoneySchema.nullable(),
    country: idOf("country").nullable(),
    status: idOf("status").nullable(),
    abroadFromMonth: CountSchema.nullable(),
    settledStatus: idOf("status").nullable(),
    settledFromMonth: CountSchema.nullable(),
  }),
  behaviour: z.strictObject({
    courtMonths: CountSchema,
    agreeBp: BpSchema,
    marryAfterMonths: CountSchema,
    marryInDecember: z.boolean(),
    patienceMonths: CountSchema.nullable(),
    jealousBp: BpSchema,
    recallBp: BpSchema,
    plan: z.string().min(1),
    papers: z.boolean(),
  }),
  spots: z.array(z.string().min(1)),
  whats: z.array(z.string().min(1)),
  calls: z.array(z.string().min(1)),
});

export type PersonEntryMatches = Proof<Same<z.infer<typeof PersonEntrySchema>, PersonEntry>>;
