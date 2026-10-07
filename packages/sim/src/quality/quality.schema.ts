import { z } from "zod";

import { idOf, IntSchema, type Proof, type Same } from "../engine/language.schema";
import type { QualityEntry } from "../engine/types";

export const QualityEntrySchema = z
  .strictObject({
    id: idOf("quality"),
    group: z.enum(["education", "work", "skills", "proof", "people", "self"]),
    min: IntSchema,
    max: IntSchema,
    shown: z.boolean(),
    counts: z.array(idOf("route")),
  })
  .check(z.refine((entry) => entry.min <= entry.max, { error: "A quality's min must not be above its max" }));

export type QualityEntryMatches = Proof<Same<z.infer<typeof QualityEntrySchema>, QualityEntry>>;
