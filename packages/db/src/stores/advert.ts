import type { AdvertReview, AdvertStore, Advertiser, Campaign, Creative } from "@japacity/store";
import { refuse } from "@japacity/store";
import { and, asc, eq, max, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { advertCounts, advertReviews, advertisers, campaigns, creatives } from "../schema";
import { accept } from "./result";

function toAdvertiser(row: typeof advertisers.$inferSelect): Advertiser {
  return {
    id: row.id,
    businessName: row.businessName,
    registration: { country: row.registrationCountry, number: row.registrationNumber },
    contactName: row.contactName,
    contactEmail: row.contactEmail,
  };
}

function toCampaign(row: typeof campaigns.$inferSelect): Campaign {
  const { id, advertiser, slots, regions, starts, ends, status, category, place } = row;
  return { id, advertiser, slots, regions, starts, ends, status, category, place };
}

function toCreative(row: typeof creatives.$inferSelect): Creative {
  const { id, campaign, file, text, link, version, status } = row;
  return { id, campaign, file, text, link, version, status };
}

function toReview(row: typeof advertReviews.$inferSelect): AdvertReview {
  const { creative, version, reviewer, at, checks, bannedListVersion, outcome, note } = row;
  return { creative, version, reviewer, at, checks, bannedListVersion, outcome, note };
}

const CREATIVE_COLUMNS = {
  id: creatives.id,
  version: creatives.version,
  campaign: creatives.campaign,
  file: creatives.file,
  text: creatives.text,
  link: creatives.link,
  status: creatives.status,
};

/** R-ADVERT-020: one row per advertiser, campaign and creative version; reviews insert only; counts one upsert per key. */
export function pgAdvertStore(handle: Handle): AdvertStore {
  return {
    addAdvertiser: (row) =>
      handle.read(async (db) => {
        const made = await db
          .insert(advertisers)
          .values({
            id: row.id,
            businessName: row.businessName,
            registrationCountry: row.registration.country,
            registrationNumber: row.registration.number,
            contactName: row.contactName,
            contactEmail: row.contactEmail,
          })
          .onConflictDoNothing()
          .returning();
        const [stored] = made;
        return stored === undefined ? refuse("exists", `The advertiser ${row.id} exists.`) : accept(toAdvertiser(stored));
      }),

    advertiser: (id) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(advertisers).where(eq(advertisers.id, id));
        return row === undefined ? null : toAdvertiser(row);
      }),

    addCampaign: (row) =>
      handle.transaction(async (tx) => {
        const [owner] = await tx.select({ id: advertisers.id }).from(advertisers).where(eq(advertisers.id, row.advertiser));
        if (owner === undefined) return refuse("missing", `No advertiser ${row.advertiser}.`);
        const [stored] = await tx.insert(campaigns).values(row).onConflictDoNothing().returning();
        return stored === undefined ? refuse("exists", `The campaign ${row.id} exists.`) : accept(toCampaign(stored));
      }),

    campaign: (id) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
        return row === undefined ? null : toCampaign(row);
      }),

    campaigns: () =>
      handle.read(async (db) => {
        const rows = await db.select().from(campaigns).orderBy(asc(campaigns.id));
        return rows.map(toCampaign);
      }),

    setCampaignStatus: (id, status) =>
      handle.read(async (db) => {
        const [row] = await db.update(campaigns).set({ status }).where(eq(campaigns.id, id)).returning();
        return row === undefined ? refuse("missing", `No campaign ${id}.`) : accept(toCampaign(row));
      }),

    addCreative: (row, image) =>
      handle.transaction(async (tx) => {
        const [owner] = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, row.campaign)).for("update");
        if (owner === undefined) return refuse("missing", `No campaign ${row.campaign}.`);
        const [other] = await tx.select({ campaign: creatives.campaign }).from(creatives).where(eq(creatives.id, row.id)).limit(1);
        if (other !== undefined && other.campaign !== row.campaign) return refuse("conflict", `The creative ${row.id} belongs to ${other.campaign}.`);
        const [held] = await tx.select({ version: creatives.version }).from(creatives).where(and(eq(creatives.id, row.id), eq(creatives.version, row.version)));
        if (held !== undefined) return refuse("exists", `The creative ${row.id} has a version ${String(row.version)}.`);
        const [top] = await tx.select({ latest: max(creatives.version) }).from(creatives).where(eq(creatives.id, row.id));
        const next = (top?.latest ?? 0) + 1;
        if (row.version !== next) return refuse("stale", `The next version of ${row.id} is ${String(next)}.`);
        const [stored] = await tx
          .insert(creatives)
          .values({ ...row, image })
          .returning(CREATIVE_COLUMNS);
        if (stored === undefined) throw new Error(`The creative ${row.id} was not stored.`);
        return accept(stored);
      }),

    creatives: (campaign) =>
      handle.read(async (db) => {
        const rows = await db.select(CREATIVE_COLUMNS).from(creatives).where(eq(creatives.campaign, campaign)).orderBy(asc(creatives.id), asc(creatives.version));
        return rows.map((row) => toCreative({ ...row, image: new Uint8Array() }));
      }),

    creative: (id, version) =>
      handle.read(async (db) => {
        const [row] = await db.select(CREATIVE_COLUMNS).from(creatives).where(and(eq(creatives.id, id), eq(creatives.version, version)));
        return row === undefined ? null : toCreative({ ...row, image: new Uint8Array() });
      }),

    setCreativeStatus: (id, version, status) =>
      handle.read(async (db) => {
        const [row] = await db
          .update(creatives)
          .set({ status })
          .where(and(eq(creatives.id, id), eq(creatives.version, version)))
          .returning(CREATIVE_COLUMNS);
        return row === undefined ? refuse("missing", `No version ${String(version)} of ${id}.`) : accept(row);
      }),

    image: (id, version) =>
      handle.read(async (db) => {
        const [row] = await db.select({ image: creatives.image }).from(creatives).where(and(eq(creatives.id, id), eq(creatives.version, version)));
        return row?.image ?? null;
      }),

    addReview: (row) =>
      handle.read(async (db) => {
        await db.insert(advertReviews).values(row);
      }),

    reviews: (creative) =>
      handle.read(async (db) => {
        const rows = await db.select().from(advertReviews).where(eq(advertReviews.creative, creative)).orderBy(asc(advertReviews.n));
        return rows.map(toReview);
      }),

    addCounts: (rows) =>
      handle.read(async (db) => {
        if (rows.length === 0) return;
        await db
          .insert(advertCounts)
          .values(rows)
          .onConflictDoUpdate({
            target: [advertCounts.day, advertCounts.slot, advertCounts.campaign, advertCounts.region],
            set: { impressions: sql`${advertCounts.impressions} + excluded.impressions`, taps: sql`${advertCounts.taps} + excluded.taps` },
          });
      }),

    counts: (campaign) =>
      handle.read(async (db) =>
        db
          .select({ day: advertCounts.day, slot: advertCounts.slot, campaign: advertCounts.campaign, region: advertCounts.region, impressions: advertCounts.impressions, taps: advertCounts.taps })
          .from(advertCounts)
          .where(eq(advertCounts.campaign, campaign))
          .orderBy(asc(advertCounts.day), asc(advertCounts.slot), asc(advertCounts.region)),
      ),
  };
}
