CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE TABLE "analytics"."counter_runs" (
	"run" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."counter_totals" (
	"day" text NOT NULL,
	"region" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"count" bigint NOT NULL,
	CONSTRAINT "counter_totals_day_region_name_key_pk" PRIMARY KEY("day","region","name","key")
);
