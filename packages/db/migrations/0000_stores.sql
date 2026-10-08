CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"age_passed" boolean NOT NULL,
	"age_at" bigint NOT NULL,
	"age_method" text NOT NULL,
	"created_at" bigint NOT NULL,
	"character" text
);
--> statement-breakpoint
CREATE TABLE "deletions" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deletions_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account" text,
	"account_hash" text NOT NULL,
	"requested_at" bigint NOT NULL,
	"due_at" bigint NOT NULL,
	"completed_at" bigint
);
--> statement-breakpoint
CREATE TABLE "audit" (
	"n" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_n_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"character" text NOT NULL,
	"why" text NOT NULL,
	"at" bigint NOT NULL,
	"note" text NOT NULL,
	"segments" jsonb NOT NULL,
	"log" jsonb NOT NULL,
	"snapshots" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"v" integer NOT NULL,
	"refilled_at" bigint NOT NULL,
	"segment" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_log" (
	"character" text NOT NULL,
	"v" integer NOT NULL,
	"tick" integer NOT NULL,
	"sender" text NOT NULL,
	"command" jsonb NOT NULL,
	"hash" text NOT NULL,
	"at" bigint NOT NULL,
	CONSTRAINT "command_log_character_v_pk" PRIMARY KEY("character","v")
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"key" text PRIMARY KEY NOT NULL,
	"a" text NOT NULL,
	"b" text NOT NULL,
	"v" integer NOT NULL,
	"record" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"character" text NOT NULL,
	"segment" integer NOT NULL,
	"from_v" integer NOT NULL,
	"content" text NOT NULL,
	"overlay" text,
	"start" jsonb NOT NULL,
	CONSTRAINT "segments_character_segment_pk" PRIMARY KEY("character","segment")
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"character" text NOT NULL,
	"segment" integer NOT NULL,
	"v" integer NOT NULL,
	"content" text NOT NULL,
	"overlay" text,
	"state" jsonb NOT NULL,
	CONSTRAINT "snapshots_character_segment_v_pk" PRIMARY KEY("character","segment","v")
);
--> statement-breakpoint
CREATE TABLE "ledger_days" (
	"day" integer NOT NULL,
	"side" text NOT NULL,
	"reason" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "ledger_days_day_side_reason_currency_pk" PRIMARY KEY("day","side","reason","currency")
);
--> statement-breakpoint
CREATE TABLE "ledger_marks" (
	"character" text PRIMARY KEY NOT NULL,
	"day" integer NOT NULL,
	"totals" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draw_tickets" (
	"draw" integer NOT NULL,
	"n" integer NOT NULL,
	"character" text NOT NULL,
	CONSTRAINT "draw_tickets_draw_n_pk" PRIMARY KEY("draw","n")
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"draw" integer PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"fingerprint" text NOT NULL,
	"beacon_round" bigint NOT NULL,
	"closed_at" bigint,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "world_ticks" (
	"tick" integer PRIMARY KEY NOT NULL,
	"world" jsonb NOT NULL,
	"book" jsonb NOT NULL,
	"content" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_tickets" ADD CONSTRAINT "draw_tickets_draw_draws_draw_fk" FOREIGN KEY ("draw") REFERENCES "public"."draws"("draw") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deletions_pending_idx" ON "deletions" USING btree ("account") WHERE "deletions"."completed_at" is null;--> statement-breakpoint
CREATE INDEX "deletions_hash_idx" ON "deletions" USING btree ("account_hash");--> statement-breakpoint
CREATE INDEX "deletions_due_idx" ON "deletions" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "audit_character_idx" ON "audit" USING btree ("character","n");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "characters_account_idx" ON "characters" USING btree ("account");--> statement-breakpoint
CREATE INDEX "pairs_a_idx" ON "pairs" USING btree ("a");--> statement-breakpoint
CREATE INDEX "pairs_b_idx" ON "pairs" USING btree ("b");