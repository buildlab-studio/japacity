// pnpm test:browser:real [--staging] [playwright's own arguments]: the real project against the
// local stack, or with --staging against staging behind Access (tools/local/access.ts). Anything else is
// handed to `playwright test` as given.
import { spawnSync } from "node:child_process";

import { realRun } from "./access";
import { REPO_ROOT } from "../repo";

const run = realRun(process.argv.slice(2), process.env);
const result = spawnSync("pnpm", ["exec", "playwright", "test", "-c", "apps/client/playwright.config.ts", "--project", "real", ...run.args], { cwd: REPO_ROOT, stdio: "inherit", env: run.env });
process.exitCode = result.status ?? 1;
