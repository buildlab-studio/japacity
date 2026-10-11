CREATE TABLE "appeals" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appeals_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" text NOT NULL,
	"account" text NOT NULL,
	"entry" text NOT NULL,
	"at" bigint NOT NULL,
	"status" text NOT NULL,
	"outcome" text,
	"decided_by" text,
	"decided_at" bigint
);
--> statement-breakpoint
CREATE TABLE "banned_identities" (
	"hash" text PRIMARY KEY NOT NULL,
	"at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" text NOT NULL,
	"text" text NOT NULL,
	"build" text NOT NULL,
	"screen" text NOT NULL,
	"mode" text NOT NULL,
	"day" text NOT NULL,
	"region" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_sends" (
	"sender" text NOT NULL,
	"day" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "feedback_sends_sender_day_pk" PRIMARY KEY("sender","day")
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "moderation_log_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"id" text NOT NULL,
	"admin" text NOT NULL,
	"at" bigint NOT NULL,
	"item" text NOT NULL,
	"action" text NOT NULL,
	"params" jsonb NOT NULL,
	"reason" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_id_idx" ON "appeals" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_entry_idx" ON "appeals" USING btree ("entry");--> statement-breakpoint
CREATE INDEX "appeals_account_idx" ON "appeals" USING btree ("account");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_id_idx" ON "feedback" USING btree ("id");--> statement-breakpoint
CREATE INDEX "feedback_day_idx" ON "feedback" USING btree ("day");--> statement-breakpoint
CREATE INDEX "feedback_sends_day_idx" ON "feedback_sends" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_log_id_idx" ON "moderation_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "moderation_log_item_idx" ON "moderation_log" USING btree ("item");--> statement-breakpoint
CREATE FUNCTION "moderation_log_insert_only"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'moderation_log is insert only'; END $$;--> statement-breakpoint
CREATE TRIGGER "moderation_log_insert_only" BEFORE UPDATE OR DELETE ON "moderation_log" FOR EACH ROW EXECUTE FUNCTION "moderation_log_insert_only"();
