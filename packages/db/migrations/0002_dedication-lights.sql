CREATE TABLE "dedication_lights" (
	"account_id" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"from_year" integer,
	"to_year" integer,
	"lit_at" bigint NOT NULL,
	"approved_at" bigint,
	"approved_by" text
);
--> statement-breakpoint
ALTER TABLE "dedication_lights" ADD CONSTRAINT "dedication_lights_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dedication_lights_id_idx" ON "dedication_lights" USING btree ("id");--> statement-breakpoint
CREATE INDEX "dedication_lights_shared_idx" ON "dedication_lights" USING btree (("approved_at" is not null) desc,"lit_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "dedication_lights_pending_idx" ON "dedication_lights" USING btree ("lit_at") WHERE "dedication_lights"."approved_at" is null;