import { z } from "zod";

import { idOf, type Proof, RangeSchema, type Same } from "../engine/language.schema";
import type { DocumentEntry } from "../engine/types";

export const DocumentEntrySchema = z.strictObject({
  id: idOf("document"),
  wait: RangeSchema,
  validMonths: z.int().positive().nullable(),
  result: z.literal("english-band").nullable(),
});

export type DocumentEntryMatches = Proof<Same<z.infer<typeof DocumentEntrySchema>, DocumentEntry>>;
