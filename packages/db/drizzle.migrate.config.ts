// Applies the migrations in ./migrations to a real Postgres, the branch whose owner string is in
// DATABASE_URL_UNPOOLED (what `neon link` pulls into the repository's .env.local for the linked branch):
//   set -a; . ./.env.local; set +a; cd packages/db && pnpm exec drizzle-kit migrate --config drizzle.migrate.config.ts
// The plain drizzle.config.ts stays for `db:generate`, which needs no database.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: process.env["DATABASE_URL_UNPOOLED"] ?? "" },
});
