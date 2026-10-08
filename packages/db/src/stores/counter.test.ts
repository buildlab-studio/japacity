import { sql } from "drizzle-orm";
import { suiteForCounterStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgCounterStore } from "./counter";

const fresh = freshHandle();

suiteForCounterStore(async () => {
  const handle = await fresh();
  // The shared emptying reaches only the public schema.
  await handle.read((db) => db.execute(sql`truncate analytics.counter_totals, analytics.counter_runs`));
  return pgCounterStore(handle);
});
