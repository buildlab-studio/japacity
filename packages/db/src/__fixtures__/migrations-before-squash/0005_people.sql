CREATE TABLE "blocks" (
	"from_account" text NOT NULL,
	"to_account" text NOT NULL,
	"at" bigint NOT NULL,
	CONSTRAINT "blocks_from_account_to_account_pk" PRIMARY KEY("from_account","to_account")
);
--> statement-breakpoint
CREATE TABLE "conversation_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation" text NOT NULL,
	"sender" text NOT NULL,
	"phrase" text NOT NULL,
	"fill" text,
	"sent_at" bigint NOT NULL,
	"read_at" bigint
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"report" text PRIMARY KEY NOT NULL,
	"messages" jsonb NOT NULL,
	"pair" text,
	"until" bigint NOT NULL,
	"lifted" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_rewards" (
	"n" bigint GENERATED ALWAYS AS IDENTITY (sequence name "invite_rewards_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"from_character" text NOT NULL,
	"friend" text NOT NULL,
	"reached" text NOT NULL,
	"frame" text NOT NULL,
	"line" text NOT NULL,
	"at" bigint NOT NULL,
	CONSTRAINT "invite_rewards_from_character_friend_reached_pk" PRIMARY KEY("from_character","friend","reached")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"from_character" text NOT NULL,
	"account" text NOT NULL,
	"slot" text NOT NULL,
	"looking" text NOT NULL,
	"fill" text,
	"card" jsonb NOT NULL,
	"made_at" bigint NOT NULL,
	"expires" bigint NOT NULL,
	"used" boolean NOT NULL,
	"by_character" text,
	"pair" text,
	"used_at" bigint,
	"before" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter" text NOT NULL,
	"subject" jsonb NOT NULL,
	"reason" text NOT NULL,
	"cites" jsonb NOT NULL,
	"pair" text,
	"unverified" boolean NOT NULL,
	"at" bigint NOT NULL,
	"status" text NOT NULL,
	"outcome" text,
	"decided_at" bigint
);
--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_report_reports_id_fk" FOREIGN KEY ("report") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_to_idx" ON "blocks" USING btree ("to_account");--> statement-breakpoint
CREATE INDEX "conversation_rows_conversation_idx" ON "conversation_rows" USING btree ("conversation","sent_at");--> statement-breakpoint
CREATE INDEX "invite_rewards_friend_idx" ON "invite_rewards" USING btree ("friend");--> statement-breakpoint
CREATE INDEX "invites_from_idx" ON "invites" USING btree ("from_character");--> statement-breakpoint
CREATE INDEX "invites_by_idx" ON "invites" USING btree ("by_character");--> statement-breakpoint
CREATE INDEX "invites_pair_idx" ON "invites" USING btree ("pair");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter","at");--> statement-breakpoint
CREATE INDEX "reports_pair_idx" ON "reports" USING btree ("pair");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","at");