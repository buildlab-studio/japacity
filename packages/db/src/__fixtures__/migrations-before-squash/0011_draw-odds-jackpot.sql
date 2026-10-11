ALTER TABLE "draws" ADD COLUMN "odds" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "draws" ADD COLUMN "jackpot" bigint NOT NULL;