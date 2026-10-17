// The memory adapter's tables, for tests: the library's four, the passkey
// plugin's, and the `database` rate-limit store's.
// https://better-auth.com/docs/adapters/memory
import { memoryAdapter } from "better-auth/adapters/memory";

export type AuthTables = Record<"user" | "session" | "account" | "verification" | "passkey" | "rateLimit", Record<string, unknown>[]>;

export function memoryAuthTables(): AuthTables {
  return { user: [], session: [], account: [], verification: [], passkey: [], rateLimit: [] };
}

export function memoryAuthAdapter(tables: AuthTables = memoryAuthTables()) {
  return memoryAdapter(tables);
}
