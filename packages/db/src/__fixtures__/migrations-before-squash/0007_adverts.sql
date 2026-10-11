CREATE TABLE "advert_counts" (
	"day" integer NOT NULL,
	"slot" text NOT NULL,
	"campaign" text NOT NULL,
	"region" text NOT NULL,
	"impressions" bigint NOT NULL,
	"taps" bigint NOT NULL,
	CONSTRAINT "advert_counts_day_slot_campaign_region_pk" PRIMARY KEY("day","slot","campaign","region")
);
--> statement-breakpoint
CREATE TABLE "advert_reviews" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "advert_reviews_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"creative" text NOT NULL,
	"version" integer NOT NULL,
	"reviewer" text NOT NULL,
	"at" bigint NOT NULL,
	"checks" jsonb NOT NULL,
	"banned_list_version" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advertisers" (
	"id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"registration_country" text NOT NULL,
	"registration_number" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"advertiser" text NOT NULL,
	"slots" jsonb NOT NULL,
	"regions" jsonb NOT NULL,
	"starts" bigint NOT NULL,
	"ends" bigint NOT NULL,
	"status" text NOT NULL,
	"category" text NOT NULL,
	"place" jsonb
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"campaign" text NOT NULL,
	"file" jsonb NOT NULL,
	"text" text NOT NULL,
	"link" text,
	"status" text NOT NULL,
	"image" "bytea" NOT NULL,
	CONSTRAINT "creatives_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_advertisers_id_fk" FOREIGN KEY ("advertiser") REFERENCES "public"."advertisers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_campaigns_id_fk" FOREIGN KEY ("campaign") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advert_reviews_creative_idx" ON "advert_reviews" USING btree ("creative","n");--> statement-breakpoint
CREATE INDEX "creatives_campaign_idx" ON "creatives" USING btree ("campaign");