import { z } from "zod";

import { BpSchema, CountSchema, idOf, IntSchema, type Proof, type Same } from "../engine/language.schema";
import type { PlaceEntry } from "../engine/types";

/** One place of the city: docs/rules/city.md. */
export const PlaceEntrySchema = z.strictObject({
  id: idOf("place"),
  where: z.enum(["home", "abroad", "road"]),
  country: idOf("country").nullable(),
  city: z.string().min(1).nullable(),
  area: z.string().min(1).nullable(),
  nameKind: z.enum(["public", "institution", "business", "stylised"]),
  realName: z.string().min(1).nullable(),
  position: z.strictObject({ latE3: IntSchema, lonE3: IntSchema }).nullable(),
  data: z.strictObject({ source: z.enum(["osm", "overture", "own"]), licence: z.enum(["ODbL-1.0", "CDLA-Permissive-2.0"]).nullable(), checked: z.string().min(1) }).nullable(),
  sponsor: z.strictObject({ key: z.string().min(1) }).nullable(),
  scope: z.enum(["exterior", "interior"]),
  hub: z.boolean(),
  occasion: z.boolean(),
  stages: z.array(z.union([idOf("activity"), idOf("offer"), idOf("setpiece"), idOf("chapter")])),
  crowd: z.strictObject({ low: CountSchema, high: CountSchema, target: CountSchema }),
  traditionalBp: BpSchema,
  assets: z.string().min(1),
  // R-PLACE-013 (decision 0017): the employer's shuttle serves the place.
  shuttle: z.boolean(),
});

export type PlaceEntryMatches = Proof<Same<z.infer<typeof PlaceEntrySchema>, PlaceEntry>>;
