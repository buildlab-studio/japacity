// pnpm test:browser:real [--staging] [playwright's own arguments]: the online-real project against the
// local stack, or with --staging against staging behind Access (tools/local/access.ts). Anything else is
// handed to `playwright test` as given.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { realRun } from "./access";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const run = realRun(process.argv.slice(2), process.env);
const result = spawnSync("pnpm", ["exec", "playwright", "test", "-c", "apps/client/e2e/playwright.real.config.ts", ...run.args], { cwd: ROOT, stdio: "inherit", env: run.env });
process.exitCode = result.status ?? 1;
