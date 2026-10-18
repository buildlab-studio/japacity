// The client's Playwright projects, each run by its own root script:
//
// - "Pixel 7" and "Desktop Chrome" (`pnpm test:browser`): the browser suite at both sizes the game is built for, a
//   mid-range Android phone, as most players in Nigeria come on a phone, and a desktop, which many in the United
//   Kingdom use. Against the dev server, so the fast clock is on.
// - "real" (`pnpm test:browser:real`, server:production-and-staging): the client as the local Worker serves it, against
//   Postgres and Mailpit in Docker Compose, nothing faked. Start the stack first with `pnpm dev:full`. With
//   `--staging` it points at staging instead, with the Access service token's headers from CF_ACCESS_CLIENT_ID and
//   CF_ACCESS_CLIENT_SECRET (tools/local/access.ts).
// - "catalog" (`pnpm catalog`): every screen of the game shot as a player sees it on a phone, laid out on one page for
//   a look against e2e/catalog/CHECKLIST.md. A tool run by hand. The pictures go to CATALOG_DIR, else to
//   `.catalog/<short commit>/` in the main checkout, which git ignores (e2e/catalog/where.ts); so does Playwright's own output.
//
// Only the browser suite runs when no project is named. None of them is part of `pnpm check`.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { realTarget } from "../../tools/local/access";
import { readLocalStack } from "../../tools/local/env";
import { SOFTWARE_WEBGL } from "./e2e/support/browser";

// Two worktrees running at once each pick their own ports through these.
const PORT = Number(process.env.E2E_PORT ?? "5179");
/** The client built against a server, for online.spec.ts: the server is this same origin, every /api route faked by the spec. */
const ONLINE_PORT = Number(process.env.E2E_ONLINE_PORT ?? "5180");
const CATALOG_WORKERS = Number(process.env.CATALOG_WORKERS ?? "3");

/** The projects named on the command line with --project; none named runs the default ones. */
function askedProjects(argv: readonly string[]): string[] {
  const asked: string[] = [];
  for (const [at, arg] of argv.entries()) {
    if (arg.startsWith("--project=")) asked.push(arg.slice("--project=".length));
    else if (arg === "--project" && argv[at + 1] !== undefined) asked.push(argv[at + 1] ?? "");
  }
  return asked;
}

const asked = askedProjects(process.argv);
const only = (...names: string[]) => asked.length > 0 && asked.every((name) => names.includes(name));
/** The real tests run against the local stack or staging, so a run of them alone starts no dev server. */
const realOnly = only("real");
const catalogOnly = only("catalog");

/** The real tests' address. A local stack that cannot be read leaves it unset here; the real tests' setup then stops with the reason. */
function realUse(): { baseURL?: string; ignoreHTTPSErrors: boolean; trace: "retain-on-failure" | "off" } {
  try {
    const stack = readLocalStack(fileURLToPath(new URL("../..", import.meta.url)));
    const target = realTarget(process.env, stack.siteUrl);
    return {
      baseURL: target.baseUrl,
      // wrangler serves the local address with its own self-signed certificate; staging's is real.
      ignoreHTTPSErrors: target.local,
      // Staging's Access headers go on by route, to staging's origin alone (withAccess in tools/local/access.ts).
      // A trace keeps every request's headers, so none is written where the Access token travels.
      trace: target.local ? "retain-on-failure" : "off",
    };
  } catch {
    return { ignoreHTTPSErrors: false, trace: "off" };
  }
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  // The catalog's software renderer is heavy: a few lives at once, each its own part of the catalog.
  ...(catalogOnly ? { workers: CATALOG_WORKERS } : {}),
  projects: [
    ...[
      { name: "Pixel 7", use: { ...devices["Pixel 7"] } },
      { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    ].map((project) => ({
      ...project,
      testMatch: "*.spec.ts",
      testIgnore: "catalog/**",
      use: { ...project.use, baseURL: `http://localhost:${String(PORT)}`, trace: "retain-on-failure" as const },
    })),
    {
      name: "real",
      default: false,
      testDir: "e2e/real",
      testMatch: "*.real.ts",
      dependencies: ["real-setup"],
      // One life is played through the tests in order, on one database, under one address's limits.
      fullyParallel: false,
      workers: 1,
      timeout: 240_000,
      use: { ...devices["Pixel 7"], ...realUse(), launchOptions: SOFTWARE_WEBGL },
    },
    { name: "real-setup", default: false, testDir: "e2e/real", testMatch: "stack.setup.ts", timeout: 240_000, use: { trace: "off" } },
    {
      name: "catalog",
      default: false,
      testDir: "e2e/catalog",
      testMatch: "catalog.spec.ts",
      dependencies: ["catalog-setup"],
      workers: CATALOG_WORKERS,
      timeout: 900_000,
      outputDir: join(tmpdir(), "japacity-catalog-output"),
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: Number(process.env.CATALOG_SCALE ?? "3"),
        baseURL: `http://localhost:${String(PORT)}`,
        trace: "off",
        // A step that cannot be taken fails in seconds, so its screen is written down as not reached and the shoot goes on.
        actionTimeout: 15_000,
        navigationTimeout: 60_000,
        launchOptions: SOFTWARE_WEBGL,
      },
    },
    { name: "catalog-setup", default: false, testDir: "e2e/catalog", testMatch: "catalog.setup.ts", teardown: "catalog-teardown", use: { trace: "off" } },
    { name: "catalog-teardown", default: false, testDir: "e2e/catalog", testMatch: "catalog.teardown.ts", use: { trace: "off" } },
  ],
  webServer: realOnly
    ? []
    : [
        {
          command: `pnpm --filter @japacity/client exec vite --port ${String(PORT)} --strictPort`,
          url: `http://localhost:${String(PORT)}`,
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          command: `pnpm --filter @japacity/client exec vite --port ${String(ONLINE_PORT)} --strictPort`,
          url: `http://localhost:${String(ONLINE_PORT)}`,
          env: { VITE_SERVER_URL: `http://localhost:${String(ONLINE_PORT)}` },
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
