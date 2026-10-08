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
ALTER TABLE "switches" ADD COLUMN "boards_this_week_everyone" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "boards_this_week_friends" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "boards_all_time_everyone" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "boards_all_time_friends" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "boards_joined_week" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board_figures" ADD CONSTRAINT "board_figures_character_characters_id_fk" FOREIGN KEY ("character") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_figures_figure_idx" ON "board_figures" USING btree ("figure" DESC NULLS LAST,"joined_at","character") WHERE "board_figures"."listed" and "board_figures"."figure" is not null;--> statement-breakpoint
CREATE INDEX "board_figures_week_idx" ON "board_figures" USING btree ("week");--> statement-breakpoint
CREATE INDEX "board_figures_account_idx" ON "board_figures" USING btree ("account");--> statement-breakpoint
CREATE INDEX "board_figures_joined_week_idx" ON "board_figures" USING btree ("joined_week");