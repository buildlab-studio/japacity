// server:migration-before-deploy: the migrations start from one file, 0000_japacity, every table generated from the
// Drizzle schema and then the functions and triggers written by hand. This proves that file builds the very structure
// the three migrations in __fixtures__/migrations-three build: one fresh PGlite migrated with the three, another with
// the one, and a walk of each catalog compared.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, test } from "vitest";

const THREE = fileURLToPath(new URL("./__fixtures__/migrations-three", import.meta.url));
const COMMITTED = fileURLToPath(new URL("../migrations", import.meta.url));

interface Journal {
  entries: { idx: number; tag: string; when: number }[];
}

const journalOf = (folder: string): Journal => JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as Journal;

const scratch: string[] = [];
afterAll(() => {
  for (const folder of scratch) rmSync(folder, { recursive: true, force: true });
});

/** A folder holding only the committed 0000, with a journal cut to it. */
function firstOnly(): string {
  const folder = mkdtempSync(join(tmpdir(), "japacity-migrations-"));
  scratch.push(folder);
  mkdirSync(join(folder, "meta"));
  const journal = journalOf(COMMITTED);
  const entries = journal.entries.slice(0, 1);
  writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  for (const entry of entries) copyFileSync(join(COMMITTED, `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
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

describe("the one migration", () => {
  test("[server:migration-before-deploy] given one database migrated with the three and one with 0000_japacity alone, when both catalogs are walked, then every schema, table, column, constraint, index, sequence, function and trigger is the same", { timeout: 60000 }, async () => {
    expect(journalOf(THREE).entries.map((entry) => entry.tag)).toEqual(["0000_japacity", "0001_person", "0002_switch-log-insert-only"]);
    expect(journalOf(COMMITTED).entries.map((entry) => entry.tag)).toEqual(["0000_japacity"]);
    const before = await migrated(THREE);
    const after = await migrated(firstOnly());
    try {
      const three = await walk(before);
      const one = await walk(after);
      // The walk sees what it should, so two empty walks cannot pass.
      expect(three.schemas).toEqual(expect.arrayContaining(["analytics", "drizzle", "public"]));
      expect(three.relations.filter((line) => /^public \| (user|session|account|verification|passkey|rate_limit) \|/.test(line))).toHaveLength(6);
      expect(three.columns).toEqual(expect.arrayContaining([expect.stringMatching(/^public \| characters \| person \| jsonb \| false \|/)]));
      expect(three.functions.map((line) => line.split(" | ").slice(0, 2).join(" | "))).toEqual(["public | moderation_log_insert_only", "public | switch_log_insert_only"]);
      expect(three.triggers).toHaveLength(2);
      expect(three.columns.length).toBeGreaterThan(200);
      expect(one).toEqual(three);
    } finally {
      await before.close();
      await after.close();
    }
  });
});
