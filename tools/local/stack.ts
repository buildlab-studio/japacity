// The local stack's steps, shared by `pnpm dev:full` and `pnpm db:migrate:local` (server.md R-SERVER-038).
import { spawnSync } from "node:child_process";

import type { LocalStack } from "./env";

/** Starts Postgres and Mailpit in Docker Compose and waits for both to be healthy. False when Docker cannot. */
export function composeUp(root: string): boolean {
  const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (docker.status !== 0) {
    console.error("Docker is not running. Start Docker Desktop (or your Docker engine), then run this again.");
    console.error("A Postgres and a Mailpit of your own will do instead: pnpm dev:full --no-compose");
    return false;
  }
  return spawnSync("docker", ["compose", "up", "--detach", "--wait"], { cwd: root, stdio: "inherit" }).status === 0;
}

/**
 * Applies the committed migrations to the local database. drizzle-kit reads DATABASE_URL_UNPOOLED
 * (drizzle.migrate.config.ts); here it is set for this one child to the local string only.
 */
export function migrate(root: string, stack: LocalStack): boolean {
  const result = spawnSync("pnpm", ["--filter", "@japacity/db", "exec", "drizzle-kit", "migrate", "--config", "drizzle.migrate.config.ts"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL_UNPOOLED: stack.databaseUrl },
  });
  return result.status === 0;
}
