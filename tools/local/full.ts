// pnpm dev:full [--no-compose]: the whole online game on this machine, with no paid service
// (server.md R-SERVER-038). Postgres and Mailpit in Docker Compose, the migrations, the client
// built by Vite (watching) for the local Worker, and `wrangler dev` serving that build and /api
// on SITE_URL, as one Worker serves a deployment. Ctrl+C stops Vite and wrangler; the Compose
// services keep running until `docker compose stop`. `pnpm dev` stays the offline game.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { join } from "node:path";

import { cronUrl, hyperdriveEnv, LOCAL_DIST, type LocalStack, readLocalStack, workerEnvFile, wranglerArgs } from "./env";
import { composeUp, migrate } from "./stack";
import { REPO_ROOT } from "../repo";

/** R-CLOCK-012: the deployments tick every five minutes; wrangler dev runs no cron by itself. */
const TICK_CRON = "*/5 * * * *";
const TICK_MS = 5 * 60 * 1000;
const WAIT_MS = 120_000;

const children: ChildProcess[] = [];

function stop(code: number): never {
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exit(code);
}

/** One https call to the local Worker, whose certificate is wrangler's own and self-signed. */
function local(url: string, method: "GET" | "POST", body?: string): Promise<number> {
  return new Promise((resolve) => {
    const call = request(url, { method, rejectUnauthorized: false, headers: body === undefined ? {} : { "content-type": "application/json" } }, (reply) => {
      reply.resume();
      resolve(reply.statusCode ?? 0);
    });
    call.on("error", () => resolve(0));
    call.setTimeout(5_000, () => call.destroy());
    if (body !== undefined) call.write(body);
    call.end();
  });
}

async function waitFor(what: string, ready: () => Promise<boolean> | boolean): Promise<void> {
  for (let waited = 0; waited < WAIT_MS; waited += 1_000) {
    if (await ready()) return;
    await new Promise((done) => setTimeout(done, 1_000));
  }
  console.error(`${what} did not start within ${String(WAIT_MS / 1000)} seconds.`);
  stop(1);
}

function tick(stack: LocalStack): void {
  void local(cronUrl(stack), "POST", JSON.stringify({ cron: TICK_CRON })).then((status) => {
    if (status !== 200) console.error(`The world's tick did not run (${String(status)}).`);
  });
}

async function main(): Promise<void> {
  const compose = !process.argv.includes("--no-compose");
  let stack: LocalStack;
  try {
    stack = readLocalStack(REPO_ROOT);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  if (compose && !composeUp(REPO_ROOT)) process.exit(1);
  if (!migrate(REPO_ROOT, stack)) process.exit(1);

  const dist = join(REPO_ROOT, LOCAL_DIST);
  const localDir = join(REPO_ROOT, "apps/server/.wrangler/local");
  mkdirSync(localDir, { recursive: true });
  rmSync(join(dist, "index.html"), { force: true });
  const vite = spawn("pnpm", ["--filter", "@japacity/client", "exec", "vite", "build", "--watch", "--outDir", dist, "--emptyOutDir"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, ...stack.client },
  });
  children.push(vite);
  await waitFor("Vite's first build", () => existsSync(join(dist, "index.html")));

  const envFile = join(localDir, "worker.env");
  writeFileSync(envFile, workerEnvFile(stack), { mode: 0o600 });
  const wrangler = spawn("pnpm", ["--filter", "@japacity/server", "exec", "wrangler", ...wranglerArgs(stack, envFile, dist)], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, ...hyperdriveEnv(stack) },
  });
  children.push(wrangler);
  for (const child of children) child.on("exit", (code) => stop(code ?? 1));
  await waitFor("wrangler dev", async () => (await local(`${stack.siteUrl}/api/health`, "GET")) === 200);

  tick(stack);
  setInterval(() => tick(stack), TICK_MS);
  console.log(
    [
      "",
      "The whole game is running on this machine:",
      `  The game     ${stack.siteUrl}  (wrangler's own certificate: let the browser trust it once)`,
      `  Mail inbox   ${stack.mailpitUrl}  (every email code and notice lands here)`,
      `  Postgres     ${stack.databaseUrl}`,
      `  The world ticks every five minutes. One more now: curl -k -X POST '${cronUrl(stack)}' -H 'content-type: application/json' -d '{"cron":"${TICK_CRON}"}'`,
      "  The real browser tests, in another terminal: pnpm test:browser:real",
      `Ctrl+C stops Vite and wrangler.${compose ? " docker compose stop stops Postgres and Mailpit; docker compose down --volumes also deletes their data." : ""}`,
      "",
    ].join("\n"),
  );
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
await main();
