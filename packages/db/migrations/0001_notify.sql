CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "notify_bank_full" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "full_at" bigint;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "full_notified_at" bigint;--> statement-breakpoint
CREATE INDEX "push_subscriptions_account_idx" ON "push_subscriptions" USING btree ("account");--> statement-breakpoint
CREATE INDEX "characters_full_idx" ON "characters" USING btree ("full_at") WHERE "characters"."full_notified_at" is null;