// Every content schema in one place, and the schema for the whole content
// object. Content imports this as @japacity/sim/schemas.
import { z } from "zod";

import { ActivityEntrySchema } from "./activity/activity.schema";
import { ChapterEntrySchema } from "./chapter/chapter.schema";
import { CountryEntrySchema } from "./country/country.schema";
import { DocumentEntrySchema } from "./document/document.schema";
import { EraEntrySchema } from "./era/era.schema";
import { GoalEntrySchema } from "./goal/goal.schema";
import { idOf, type Proof, type Same, TuningSchema } from "./engine/language.schema";
import type { Content } from "./engine/types";
import { NewsEntrySchema } from "./news/news.schema";
import { ObligationEntrySchema } from "./obligation/obligation.schema";
import { OfferEntrySchema } from "./offer/offer.schema";
import { PrologueStepSchema } from "./prologue/prologue.schema";
import { QualityEntrySchema } from "./quality/quality.schema";
import { PointsEntrySchema, RouteEntrySchema } from "./route/route.schema";
import { ScenarioEntrySchema } from "./scenario/scenario.schema";
import { SchoolEntrySchema } from "./school/school.schema";
import { SetpieceEntrySchema } from "./setpiece/setpiece.schema";
import { StatusEntrySchema } from "./status/status.schema";
import { VarEntrySchema } from "./var/var.schema";

export * from "./activity/activity.schema";
export * from "./chapter/chapter.schema";
export * from "./country/country.schema";
export * from "./document/document.schema";
export * from "./era/era.schema";
export * from "./goal/goal.schema";
export * from "./engine/language.schema";
export * from "./news/news.schema";
export * from "./obligation/obligation.schema";
export * from "./offer/offer.schema";
export * from "./prologue/prologue.schema";
export * from "./quality/quality.schema";
export * from "./route/route.schema";
export * from "./scenario/scenario.schema";
export * from "./school/school.schema";
export * from "./setpiece/setpiece.schema";
export * from "./status/status.schema";
export * from "./var/var.schema";

export const ContentSchema = z.strictObject({
  version: z.string().min(1),
  overlay: z.string().min(1).exactOptional(),
  quality: z.record(idOf("quality"), QualityEntrySchema),
  activity: z.record(idOf("activity"), ActivityEntrySchema),
  document: z.record(idOf("document"), DocumentEntrySchema),
  school: z.record(idOf("school"), SchoolEntrySchema),
  route: z.record(idOf("route"), RouteEntrySchema),
  setpiece: z.record(idOf("setpiece"), SetpieceEntrySchema),
  obligation: z.record(idOf("obligation"), ObligationEntrySchema),
  offer: z.record(idOf("offer"), OfferEntrySchema),
  chapter: z.record(idOf("chapter"), ChapterEntrySchema),
  var: z.record(idOf("var"), VarEntrySchema),
  news: z.record(idOf("news"), NewsEntrySchema),
  scenario: z.record(idOf("scenario"), ScenarioEntrySchema),
  country: z.record(idOf("country"), CountryEntrySchema),
  status: z.record(idOf("status"), StatusEntrySchema),
  goal: z.record(idOf("goal"), GoalEntrySchema),
  era: z.record(idOf("era"), EraEntrySchema),
  points: z.record(idOf("points"), PointsEntrySchema),
  prologue: z.record(z.string().min(1), PrologueStepSchema),
  tuning: TuningSchema,
});

export type ContentMatches = Proof<Same<z.infer<typeof ContentSchema>, Content>>;
