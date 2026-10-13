// The shape of a thing of the market, for the content check. The car's way on the map is in the
// tuning's schema beside the rides' (language.schema.ts).
import { z } from "zod";

import { HomePlaceSchema } from "../home/home.schema";
import { idOf, type Proof, type Same } from "../engine/language.schema";
import type { ThingAdd, ThingEntry, ThingMod } from "../engine/types";

export const ThingAddSchema = z.strictObject({ quality: idOf("quality"), amount: z.int() });

export const ThingModSchema = z.strictObject({
  activity: idOf("activity"),
  adds: z.array(ThingAddSchema).exactOptional(),
  halfDays: z.int().nonnegative().exactOptional(),
  costBp: z.int().min(0).max(10000).exactOptional(),
});

export const ThingEntrySchema = z.strictObject({
  id: idOf("thing"),
  price: z.int().positive(),
  resaleBp: z.int().min(0).max(10000),
  running: z.int().nonnegative(),
  homes: z.array(HomePlaceSchema).min(1),
  needs: z.array(idOf("thing")),
  group: z.string().min(1).nullable(),
  bought: z.array(ThingAddSchema),
  monthly: z.array(ThingAddSchema),
  acts: z.array(ThingModSchema),
  eases: z.strictObject({ thing: idOf("thing"), bp: z.int().min(0).max(10000) }).exactOptional(),
  drive: z.literal(true).exactOptional(),
});

export type ThingAddMatches = Proof<Same<z.infer<typeof ThingAddSchema>, ThingAdd>>;
export type ThingModMatches = Proof<Same<z.infer<typeof ThingModSchema>, ThingMod>>;
export type ThingEntryMatches = Proof<Same<z.infer<typeof ThingEntrySchema>, ThingEntry>>;
