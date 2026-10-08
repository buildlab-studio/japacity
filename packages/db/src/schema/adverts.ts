// R-ADVERT-020: advertisers, campaigns, creatives by version with their image,
// reviews in insert order, and daily counts. No column names a player.
import type { Id } from "@japacity/sim";
import type { AdvertCount, Campaign, CreativeFile, CreativeStatus, NamedPlace } from "@japacity/store";
import { bigint, customType, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** Postgres `bytea`, read back as a plain byte array from either driver. */
const bytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => new Uint8Array(value),
});

export const advertisers = pgTable("advertisers", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  registrationCountry: text("registration_country").notNull(),
  registrationNumber: text("registration_number").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  advertiser: text("advertiser")
    .notNull()
    .references(() => advertisers.id),
  slots: jsonb("slots").$type<Id<"advert">[]>().notNull(),
  regions: jsonb("regions").$type<string[]>().notNull(),
  starts: bigint("starts", { mode: "number" }).notNull(),
  ends: bigint("ends", { mode: "number" }).notNull(),
  status: text("status").$type<Campaign["status"]>().notNull(),
  category: text("category").notNull(),
  place: jsonb("place").$type<NamedPlace>(),
});

export const creatives = pgTable(
  "creatives",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    campaign: text("campaign")
      .notNull()
      .references(() => campaigns.id),
    file: jsonb("file").$type<CreativeFile>().notNull(),
    text: text("text").notNull(),
    link: text("link"),
    status: text("status").$type<CreativeStatus>().notNull(),
    image: bytes("image").notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.version] }), index("creatives_campaign_idx").on(table.campaign)],
);

export const advertReviews = pgTable(
  "advert_reviews",
  {
    n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    creative: text("creative").notNull(),
    version: integer("version").notNull(),
    reviewer: text("reviewer").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    checks: jsonb("checks").$type<string[]>().notNull(),
    bannedListVersion: text("banned_list_version").notNull(),
    outcome: text("outcome").$type<"approved" | "refused">().notNull(),
    note: text("note").notNull(),
  },
  (table) => [index("advert_reviews_creative_idx").on(table.creative, table.n)],
);

export const advertCounts = pgTable(
  "advert_counts",
  {
    day: integer("day").notNull(),
    slot: text("slot").$type<AdvertCount["slot"]>().notNull(),
    campaign: text("campaign").notNull(),
    region: text("region").notNull(),
    impressions: bigint("impressions", { mode: "number" }).notNull(),
    taps: bigint("taps", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.slot, table.campaign, table.region] })],
);
