ALTER TABLE "draws" ADD COLUMN "top_up_tickets" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "draws" ADD COLUMN "list" jsonb;--> statement-breakpoint
ALTER TABLE "draws" ADD COLUMN "list_hash" text;