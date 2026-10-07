import { z } from "zod";

import { idOf, IntSchema, type Proof, type Same } from "../engine/language.schema";
import type { VarEntry } from "../engine/types";

export const VarEntrySchema = z.strictObject({
  id: idOf("var"),
  start: IntSchema,
});

export type VarEntryMatches = Proof<Same<z.infer<typeof VarEntrySchema>, VarEntry>>;
