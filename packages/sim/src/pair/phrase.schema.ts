import { z } from "zod";

import { idOf, type Proof, type Same } from "../engine/language.schema";
import type { PhraseEntry } from "../engine/types";

/** A preset phrase: docs/rules/pair.md R-PAIR-011 to 014. */
export const PhraseEntrySchema = z.strictObject({
  id: idOf("phrase"),
  fill: z.enum(["spot", "route", "news", "event", "thing"]).nullable(),
  options: z.array(z.string().min(1)).exactOptional(),
  where: z.enum(["conversation", "place", "both"]),
});

export type PhraseEntryMatches = Proof<Same<z.infer<typeof PhraseEntrySchema>, PhraseEntry>>;
