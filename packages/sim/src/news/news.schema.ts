import { z } from "zod";

import {
  BpSchema,
  CountSchema,
  idOf,
  IntSchema,
  NewsStageSchema,
  type Proof,
  RangeSchema,
  RequirementSchema,
  type Same,
} from "../engine/language.schema";
import type { NewsEntry } from "../engine/types";

export const NewsEntrySchema = z.strictObject({
  id: idOf("news"),
  touches: z.array(idOf("route")),
  hear: z.array(idOf("route")),
  director: z
    .strictObject({
      group: z.string().min(1),
      needs: z.array(RequirementSchema),
      cooldown: CountSchema,
      once: z.boolean(),
      shock: z.boolean(),
      endedBy: idOf("news").nullable(),
      adds: z.array(z.strictObject({ var: idOf("var"), value: IntSchema })),
    })
    .exactOptional(),
  standIn: z.strictObject({
    chanceBp: BpSchema,
    announce: z.union([
      z.strictObject({ between: RangeSchema }),
      z.strictObject({ after: idOf("news"), stage: NewsStageSchema, lag: RangeSchema }),
    ]),
    rumourLead: CountSchema,
    // R-NEWS-002: a story comes into force no sooner than two ticks after it is announced.
    forceLag: z.int().min(2),
    endsAfter: z.int().positive().nullable(),
    sets: z.array(z.strictObject({ var: idOf("var"), value: IntSchema })),
    revert: z.boolean(),
  }),
});

export type NewsEntryMatches = Proof<Same<z.infer<typeof NewsEntrySchema>, NewsEntry>>;
