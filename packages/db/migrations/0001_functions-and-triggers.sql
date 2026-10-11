-- What the Drizzle schema cannot say, written by hand: the admin log is insert only (moderation.md contract).
-- Carried unchanged from the old 0003_moderation.sql when the fifteen migrations became this clean set (11 Oct 2026).
CREATE FUNCTION "moderation_log_insert_only"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'moderation_log is insert only'; END $$;--> statement-breakpoint
CREATE TRIGGER "moderation_log_insert_only" BEFORE UPDATE OR DELETE ON "moderation_log" FOR EACH ROW EXECUTE FUNCTION "moderation_log_insert_only"();
