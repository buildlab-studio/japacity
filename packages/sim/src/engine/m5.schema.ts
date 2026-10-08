// The pages' entries (adverts, guides, analytics). The simulation never reads them;
// the content check and the client and server do (docs/rules/adverts.md, guides.md, analytics.md).
import { z } from "zod";

import { CountSchema, idOf } from "./language.schema";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AdvertSlotEntrySchema = z.strictObject({
  id: idOf("advert"),
  surface: z.enum(["billboard", "poster", "phone-tile", "shopfront"]),
  place: z.string().min(1),
  width: CountSchema,
  height: CountSchema,
  maxBytes: CountSchema,
});

export const GuideEntrySchema = z.strictObject({
  id: idOf("guide"),
  routes: z.array(idOf("route")),
  kinds: z.array(z.string().min(1)),
  sources: z.array(z.strictObject({ url: z.url(), title: z.string().min(1), readOn: Day })),
  checkedOn: Day,
  sections: z.array(z.string().min(1)),
});

export const CounterDefSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  keys: z.union([z.array(z.string().min(1)), z.literal("region"), z.literal("id")]),
  source: z.enum(["server", "client"]),
});
