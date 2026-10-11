ALTER TABLE "accounts" ADD COLUMN "state" text DEFAULT 'secured' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "username" text DEFAULT ('player_' || substr(md5(random()::text), 1, 12)) NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "username_changed_at" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last_played_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_idx" ON "accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "accounts_idle_guests_idx" ON "accounts" USING btree ("last_played_at") WHERE "accounts"."state" = 'guest';