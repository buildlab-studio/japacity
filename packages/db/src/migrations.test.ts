// server:migration-before-deploy: the migrations start from one file, 0000_japacity, every table generated from the
// Drizzle schema and then the functions and triggers written by hand; every later migration only adds. These hold the
// committed migrations to the schema: a database migrated with them and one built from a fresh generate of the schema
// have the same structure, apart from the hand-written part, which is held to refuse what it is written to refuse.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, test } from "vitest";

import * as schema from "./schema";

const COMMITTED = fileURLToPath(new URL("../migrations", import.meta.url));

/** The functions and triggers written by hand into 0000_japacity, which the schema cannot say. */
const HAND_WRITTEN = ["moderation_log_insert_only", "switch_log_insert_only"];

interface Journal {
  entries: { idx: number; tag: string; when: number }[];
}

const journalOf = (folder: string): Journal => JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as Journal;

const scratch: string[] = [];
afterAll(() => {
  for (const folder of scratch) rmSync(folder, { recursive: true, force: true });
});

/** A migrations folder holding one file generated now from the schema, as `db:generate` would write it on an empty folder. */
async function freshFromSchema(): Promise<string> {
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  const folder = mkdtempSync(join(tmpdir(), "japacity-migrations-"));
  scratch.push(folder);
  mkdirSync(join(folder, "meta"));
  writeFileSync(join(folder, "0000_fresh.sql"), statements.join("\n--> statement-breakpoint\n"));
  writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ version: "7", dialect: "postgresql", entries: [{ idx: 0, version: "7", when: 1, tag: "0000_fresh", breakpoints: true }] }));
  return folder;
}

async function migrated(folder: string): Promise<PGlite> {
  const client = new PGlite();
  await migrate(drizzle({ client }), { migrationsFolder: folder });
  return client;
}

/** One value of a catalog row as text; the walk's queries return only text, booleans and numbers. */
function cell(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") return String(value);
  return JSON.stringify(value);
}

/** Every schema the migrations made: not Postgres's own. */
const OWN = `n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'`;

type Catalog = Record<"schemas" | "extensions" | "relations" | "columns" | "constraints" | "indexes" | "sequences" | "functions" | "triggers" | "types" | "views" | "policies", string[]>;

/**
 * The structure of one database, each part a sorted list of lines. Normalised in two ways only:
 * - Column positions are not compared. A column a later migration adds with ALTER TABLE stands last in its table,
 *   while one file made from the schema puts it where the schema declares it; nothing in the game reads a column by
 *   its position.
 * - The NOT NULL constraints Postgres 18 lists in pg_constraint are named by Postgres itself, not by a migration, so
 *   their names are left out (their column and their place in the walk stay). Every other constraint, index and
 *   sequence name is the one the migration gave, and is compared as written.
 */
async function walk(client: PGlite): Promise<Catalog> {
  const lines = async (text: string): Promise<string[]> => {
    const result = await client.query<Record<string, unknown>>(text);
    return result.rows.map((row) => Object.values(row).map(cell).join(" | ")).sort();
  };
  return {
    schemas: await lines(`select n.nspname from pg_namespace n where ${OWN}`),
    extensions: await lines(`select extname, extversion from pg_extension`),
    relations: await lines(
      `select n.nspname, c.relname, c.relkind, c.relpersistence, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${OWN} and c.relkind in ('r', 'p', 'v', 'm', 'f')`,
    ),
    columns: await lines(
      `select n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid), a.attidentity, a.attgenerated, coll.collname
       from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum left join pg_collation coll on coll.oid = a.attcollation
       where ${OWN} and c.relkind in ('r', 'p', 'v', 'm', 'f') and a.attnum > 0 and not a.attisdropped`,
    ),
    constraints: await lines(
      `select n.nspname, c.relname, case when k.contype = 'n' then '(named by Postgres)' else k.conname end, k.contype, pg_get_constraintdef(k.oid), k.condeferrable, k.condeferred, k.convalidated
       from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace where ${OWN}`,
    ),
    indexes: await lines(`select n.nspname, i.tablename, i.indexname, i.indexdef from pg_indexes i join pg_namespace n on n.nspname = i.schemaname where ${OWN}`),
    sequences: await lines(
      `select s.schemaname, s.sequencename, s.data_type, s.start_value, s.min_value, s.max_value, s.increment_by, s.cycle, s.cache_size, t.relname, a.attname, dep.deptype
       from pg_sequences s join pg_namespace n on n.nspname = s.schemaname join pg_class q on q.relname = s.sequencename and q.relnamespace = n.oid
       left join pg_depend dep on dep.objid = q.oid and dep.classid = 'pg_class'::regclass and dep.refclassid = 'pg_class'::regclass
       left join pg_class t on t.oid = dep.refobjid left join pg_attribute a on a.attrelid = dep.refobjid and a.attnum = dep.refobjsubid
       where ${OWN}`,
    ),
    functions: await lines(
      `select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname, p.provolatile, p.prosecdef, p.prosrc
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang where ${OWN}`,
    ),
    triggers: await lines(
      `select n.nspname, c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where ${OWN} and not t.tgisinternal`,
    ),
    types: await lines(
      `select n.nspname, t.typname, t.typtype, coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '')
       from pg_type t join pg_namespace n on n.oid = t.typnamespace left join pg_class c on c.oid = t.typrelid
       where ${OWN} and (t.typtype in ('e', 'd', 'r', 'm') or (t.typtype = 'c' and c.relkind = 'c'))`,
    ),
    views: await lines(`select n.nspname, v.viewname, v.definition from pg_views v join pg_namespace n on n.nspname = v.schemaname where ${OWN}`),
    policies: await lines(`select n.nspname, c.relname, p.polname, p.polcmd, p.polpermissive from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where ${OWN}`),
  };
}

const named = (lines: string[]): string[] => lines.map((line) => line.split(" | ").slice(0, 3).join(" | "));

describe("the committed migrations", () => {
  test("[server:migration-before-deploy] given the committed migrations, when their journal is read, then they start at 0000_japacity and each later one comes after the one before", () => {
    const entries = journalOf(COMMITTED).entries;
    expect(entries[0]).toMatchObject({ idx: 0, tag: "0000_japacity" });
    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_, idx) => idx));
    // Drizzle's migrator applies an entry only when it is newer than the last one a database holds, so every later
    // migration must come after the one before it.
    const whens = entries.map((entry) => entry.when);
    expect(whens).toEqual([...new Set(whens)].sort((a, b) => a - b));
  });

  test("[server:migration-before-deploy] given one database migrated with the committed migrations and one with a fresh generate of the Drizzle schema, when both catalogs are walked, then they are the same but for the hand-written functions and triggers", { timeout: 60000 }, async () => {
    const committed = await migrated(COMMITTED);
    const fresh = await migrated(await freshFromSchema());
    try {
      const fromMigrations = await walk(committed);
      const fromSchema = await walk(fresh);
      // The walk sees what it should, so two empty walks cannot pass.
      expect(fromSchema.schemas).toEqual(expect.arrayContaining(["analytics", "drizzle", "public"]));
      expect(fromSchema.relations.filter((line) => /^public \| (user|session|account|verification|passkey|rate_limit) \|/.test(line))).toHaveLength(6);
      expect(fromSchema.columns.length).toBeGreaterThan(200);
      // The hand-written part is all the migrations hold beyond the schema.
      expect(fromSchema.functions).toEqual([]);
      expect(fromSchema.triggers).toEqual([]);
      expect(fromMigrations.functions.map((line) => line.split(" | ").slice(0, 2).join(" | "))).toEqual(HAND_WRITTEN.map((name) => `public | ${name}`));
      expect(named(fromMigrations.triggers)).toEqual(["public | moderation_log | moderation_log_insert_only", "public | switch_log | switch_log_insert_only"]);
      expect({ ...fromMigrations, functions: [], triggers: [] }).toEqual(fromSchema);
    } finally {
      await committed.close();
      await fresh.close();
    }
  });

  test("[server:migration-before-deploy] [moderation:admin-actions-logged-append-only] [server:switch-log-insert-only] given a row in the admin log and one in the switch log, when an update or a delete is run on either, then the database refuses both and the rows are unchanged", { timeout: 60000 }, async () => {
    const client = await migrated(COMMITTED);
    try {
      await client.exec(`insert into moderation_log (id, admin, at, item, action, params, reason, note) values ('entry.one', 'account.admin', 1000, 'report.one', 'warn', '{}', 'spam', null)`);
      await client.exec(`insert into switch_log (at, admin, reason, change) values (1000, 'account.admin', 'a flood', '{"signups": false}')`);
      const rows = async (table: string) => (await client.query(`select * from ${table} order by n`)).rows;
      const before = { moderation: await rows("moderation_log"), switches: await rows("switch_log") };
      expect(before.moderation).toHaveLength(1);
      expect(before.switches).toHaveLength(1);

      await expect(client.exec(`update moderation_log set reason = 'nothing'`)).rejects.toThrow("moderation_log is insert only");
      await expect(client.exec(`delete from moderation_log`)).rejects.toThrow("moderation_log is insert only");
      await expect(client.exec(`update switch_log set reason = 'nothing'`)).rejects.toThrow("switch_log is insert only");
      await expect(client.exec(`delete from switch_log`)).rejects.toThrow("switch_log is insert only");
      expect({ moderation: await rows("moderation_log"), switches: await rows("switch_log") }).toEqual(before);
    } finally {
      await client.close();
    }
  });
});
