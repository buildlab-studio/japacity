// R-ANALYTICS-005: the analytics totals in a schema of their own, so the
// deployment can give it a role the game's routes do not hold. One row per
// day, region, name and key, so concurrent additions are a single upsert each.
import { bigint, pgSchema, primaryKey, text } from "drizzle-orm/pg-core";

export const analytics = pgSchema("analytics");

export const counterTotals = analytics.table(
  "counter_totals",
  {
    day: text("day").notNull(),
    region: text("region").notNull(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    count: bigint("count", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.region, table.name, table.key] })],
);

/** R-ANALYTICS-008: the runs that have added their totals, so a run adds once. */
export const counterRuns = analytics.table("counter_runs", {
  run: text("run").primaryKey(),
});
