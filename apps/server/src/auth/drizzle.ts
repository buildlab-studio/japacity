// The auth library on Postgres: Drizzle's adapter over packages/db's `auth`
// tables (decision 0004). `user.name` is stored empty: R-ACCOUNT-020 asks for
// no name, and the library's column must hold something.
// https://better-auth.com/docs/adapters/drizzle
import { schema } from "@japacity/db";
import type { Queries } from "@japacity/db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function drizzleAuthAdapter(db: Queries) {
  const { user, session, account, verification, passkey, rateLimit } = schema;
  return drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification, passkey, rateLimit } });
}
