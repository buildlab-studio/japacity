-- Written by hand (server:switch-log-insert-only): the switch log is insert only, as the admin log is (0000's
-- moderation_log_insert_only), so a trigger refuses every change and removal of a row.
CREATE FUNCTION "switch_log_insert_only"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'switch_log is insert only'; END $$;--> statement-breakpoint
CREATE TRIGGER "switch_log_insert_only" BEFORE UPDATE OR DELETE ON "switch_log" FOR EACH ROW EXECUTE FUNCTION "switch_log_insert_only"();
