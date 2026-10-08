CREATE TABLE "switch_log" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "switch_log_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" bigint NOT NULL,
	"admin" text NOT NULL,
	"reason" text NOT NULL,
	"change" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "switches" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"signups" boolean DEFAULT true NOT NULL,
	"lottery" boolean DEFAULT true NOT NULL,
	"adverts" boolean DEFAULT true NOT NULL,
	"partner_play" boolean DEFAULT true NOT NULL,
	"place_targets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computer_after_months" integer,
	"top_up_tickets" integer,
	CONSTRAINT "switches_one_row" CHECK ("switches"."id" = 1)
);
