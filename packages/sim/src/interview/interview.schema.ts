import { z } from "zod";

import { CountSchema, idOf, type Proof, type Same } from "../engine/language.schema";
import type { InterviewEntry } from "../engine/types";

/** The genuineness interview's questions: docs/rules/interview.md "Entry". */
export const InterviewEntrySchema = z.strictObject({
  id: idOf("interview"),
  ask: CountSchema,
  questions: z.array(
    z.strictObject({
      id: z.string().min(1),
      about: z.enum(["couple", "other"]),
      truth: z.enum(["first-spot", "first-what", "last-spot", "times-met", "wedding-spot", "calls", "job", "home", "last-said"]).nullable(),
      needs: z.strictObject({ met: CountSchema.exactOptional(), calls: CountSchema.exactOptional(), saidEach: CountSchema.exactOptional(), married: z.boolean().exactOptional() }),
      options: z.union([z.array(z.string().min(1)), z.enum(["spots", "whats", "calls", "wedding-spots", "jobs", "phrases"])]),
    }),
  ),
});

export type InterviewEntryMatches = Proof<Same<z.infer<typeof InterviewEntrySchema>, InterviewEntry>>;
