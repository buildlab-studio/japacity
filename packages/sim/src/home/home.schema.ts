// The shapes the home kind adds to the content language (docs/rules/home.md). Only zod is imported
// as a value, so the language schema can import this file without a cycle.
import { z } from "zod";

import type { Proof, Same } from "../engine/language.schema";
import type { HomeHost, HomePlace, Tuning } from "../engine/types";

export const HomePlaceSchema = z.enum(["place.family-house", "place.makoko", "place.compound-room", "place.hostel-room"]);
export const HomeHostSchema = z.enum(["friend", "someone"]);

/** docs/rules/home.md Numbers. */
export const HomeTuningSchema = z.strictObject({
  makokoUpkeep: z.int().nonnegative(),
  evictionBp: z.int().min(0).max(10000),
  evictionLossNaira: z.int().nonnegative(),
  guestMonths: z.int().positive(),
  hostBp: z.int().min(0).max(10000),
  returnStanding: z.int(),
  compound: z.strictObject({ rentYear: z.int().nonnegative(), feesBp: z.int().min(0).max(10000), upkeep: z.int().nonnegative() }),
  selfContainRentYear: z.int().nonnegative(),
  hostelRentKobo: z.int().nonnegative(),
  livingByHandBp: z.int().min(0).max(10000),
});

export type HomePlaceMatches = Proof<Same<z.infer<typeof HomePlaceSchema>, HomePlace>>;
export type HomeHostMatches = Proof<Same<z.infer<typeof HomeHostSchema>, HomeHost>>;
export type HomeTuningMatches = Proof<Same<z.infer<typeof HomeTuningSchema>, Tuning["home"]>>;
