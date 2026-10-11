CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"age_passed" boolean NOT NULL,
	"age_at" bigint NOT NULL,
	"age_method" text NOT NULL,
	"created_at" bigint NOT NULL,
	"character" text,
	"notify_bank_full" boolean DEFAULT false NOT NULL,
	"send_usage_counts" boolean DEFAULT true NOT NULL,
	"state" text DEFAULT 'secured' NOT NULL,
	"username" text DEFAULT ('player_' || substr(md5(random()::text), 1, 12)) NOT NULL,
	"username_changed_at" bigint,
	"last_played_at" bigint DEFAULT 0 NOT NULL
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
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL
);
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
--> statement-breakpoint
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
	"signed_in_with" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT false,
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
	"segment" integer NOT NULL,
	"full_at" bigint,
	"full_notified_at" bigint
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
	"odds" jsonb NOT NULL,
	"jackpot" bigint NOT NULL,
	"closed_at" bigint,
	"list" jsonb,
	"list_hash" text,
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
	"boards_this_week_everyone" boolean DEFAULT true NOT NULL,
	"boards_this_week_friends" boolean DEFAULT true NOT NULL,
	"boards_all_time_everyone" boolean DEFAULT true NOT NULL,
	"boards_all_time_friends" boolean DEFAULT true NOT NULL,
	"boards_joined_week" boolean DEFAULT false NOT NULL,
	"place_targets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computer_after_months" integer,
	CONSTRAINT "switches_one_row" CHECK ("switches"."id" = 1)
);
--> statement-breakpoint
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
CREATE TABLE "board_figures" (
	"character" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"scenario" text NOT NULL,
	"joined_at" bigint NOT NULL,
	"joined_week" integer NOT NULL,
	"listed" boolean NOT NULL,
	"v" integer NOT NULL,
	"figure" integer,
	"week" integer NOT NULL,
	"week_start" integer
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_advertisers_id_fk" FOREIGN KEY ("advertiser") REFERENCES "public"."advertisers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_campaigns_id_fk" FOREIGN KEY ("campaign") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_tickets" ADD CONSTRAINT "draw_tickets_draw_draws_draw_fk" FOREIGN KEY ("draw") REFERENCES "public"."draws"("draw") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_report_reports_id_fk" FOREIGN KEY ("report") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_figures" ADD CONSTRAINT "board_figures_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_idx" ON "accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "accounts_idle_guests_idx" ON "accounts" USING btree ("last_played_at") WHERE "accounts"."state" = 'guest';--> statement-breakpoint
CREATE UNIQUE INDEX "deletions_pending_idx" ON "deletions" USING btree ("account") WHERE "deletions"."completed_at" is null;--> statement-breakpoint
CREATE INDEX "deletions_hash_idx" ON "deletions" USING btree ("account_hash");--> statement-breakpoint
CREATE INDEX "deletions_due_idx" ON "deletions" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_account_idx" ON "push_subscriptions" USING btree ("account");--> statement-breakpoint
CREATE INDEX "advert_reviews_creative_idx" ON "advert_reviews" USING btree ("creative","n");--> statement-breakpoint
CREATE INDEX "creatives_campaign_idx" ON "creatives" USING btree ("campaign");--> statement-breakpoint
CREATE INDEX "audit_character_idx" ON "audit" USING btree ("character","n");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "characters_account_idx" ON "characters" USING btree ("account");--> statement-breakpoint
CREATE INDEX "characters_full_idx" ON "characters" USING btree ("full_at") WHERE "characters"."full_notified_at" is null;--> statement-breakpoint
CREATE INDEX "command_log_at_idx" ON "command_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "pairs_a_idx" ON "pairs" USING btree ("a");--> statement-breakpoint
CREATE INDEX "pairs_b_idx" ON "pairs" USING btree ("b");--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_id_idx" ON "appeals" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_entry_idx" ON "appeals" USING btree ("entry");--> statement-breakpoint
CREATE INDEX "appeals_account_idx" ON "appeals" USING btree ("account");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_id_idx" ON "feedback" USING btree ("id");--> statement-breakpoint
CREATE INDEX "feedback_day_idx" ON "feedback" USING btree ("day");--> statement-breakpoint
CREATE INDEX "feedback_sends_day_idx" ON "feedback_sends" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_log_id_idx" ON "moderation_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "moderation_log_item_idx" ON "moderation_log" USING btree ("item");--> statement-breakpoint
CREATE INDEX "blocks_to_idx" ON "blocks" USING btree ("to_account");--> statement-breakpoint
CREATE INDEX "conversation_rows_conversation_idx" ON "conversation_rows" USING btree ("conversation","sent_at");--> statement-breakpoint
CREATE INDEX "invite_rewards_friend_idx" ON "invite_rewards" USING btree ("friend");--> statement-breakpoint
CREATE INDEX "invites_from_idx" ON "invites" USING btree ("from_character");--> statement-breakpoint
CREATE INDEX "invites_by_idx" ON "invites" USING btree ("by_character");--> statement-breakpoint
CREATE INDEX "invites_pair_idx" ON "invites" USING btree ("pair");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter","at");--> statement-breakpoint
CREATE INDEX "reports_pair_idx" ON "reports" USING btree ("pair");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","at");--> statement-breakpoint
CREATE INDEX "board_figures_figure_idx" ON "board_figures" USING btree ("figure" DESC NULLS LAST,"joined_at","character") WHERE "board_figures"."listed" and "board_figures"."figure" is not null;--> statement-breakpoint
CREATE INDEX "board_figures_week_idx" ON "board_figures" USING btree ("week");--> statement-breakpoint
CREATE INDEX "board_figures_account_idx" ON "board_figures" USING btree ("account");--> statement-breakpoint
CREATE INDEX "board_figures_joined_week_idx" ON "board_figures" USING btree ("joined_week");