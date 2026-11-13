import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Fixture folders hold files that look like tests on purpose. They are inputs
// to the tools' own tests and must never run as tests themselves.
const contentEntry = fileURLToPath(new URL("./packages/content/src/index.ts", import.meta.url));

const fixtureFolders = ["tools/__fixtures__/**"];

/** Whether the command line names this project with --project. */
const asked = (name: string): boolean => process.argv.some((arg, at, all) => arg === `--project=${name}` || (arg === "--project" && all[at + 1] === name));

// The lock races need a real Postgres, so the db-race project is defined only
// when it is asked for by name: `pnpm vitest run --project db-race`.
const raceProject = asked("db-race")
  ? [
      {
        test: {
          name: "db-race",
          environment: "node",
          include: ["packages/db/src/race/*.race.test.ts"],
          testTimeout: 30000,
        },
      },
    ]
  : [];
// Simulated play: whole lives played month by month, holding the economy to its targets
// (scenario:economy-meets-its-targets) and the engine to its invariants over many random lives. These files
// take most of the tests' time, so they are the play project, defined only when asked for by name:
// `pnpm test:play`, which `pnpm check` runs after `pnpm test`, and CI's play jobs, one file to a runner.
const PLAY_TESTS = [
  "packages/sim/src/simulated-play/balance.*.test.ts",
  "packages/sim/src/simulated-play/endings.test.ts",
  "packages/sim/src/simulated-play/randomPlay*.test.ts",
];
const playProject = asked("play")
  ? [
      {
        resolve: { alias: { "@japacity/content": contentEntry } },
        test: {
          name: "play",
          environment: "node",
          include: PLAY_TESTS,
          setupFiles: ["packages/sim/vitest.setup.ts"],
          testTimeout: 60000,
        },
      },
    ]
  : [];
const serverWrangler = fileURLToPath(new URL("./apps/server/wrangler.jsonc", import.meta.url));
// The place object's tests open real sockets, which the Workers plugin runs only with shared storage.
const workersTests = "apps/server/src/**/*.workers.test.ts";
// Wrangler refuses a Hyperdrive binding without a local string; the place tests never connect to it.
const unusedPostgres = "postgres://test:test@127.0.0.1:5432/test";
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_GAME_DB ??= unusedPostgres;
// pg's CommonJS requires pg-protocol, which the Workers pool resolves to its ES wrapper (a .js file in a
// package without "type": "module") and then loads as CommonJS. Its CommonJS build is named instead
// (decision 0006: node-postgres through Hyperdrive). deps.optimizer.ssr.include does not reach that path.
const fromPg = createRequire(createRequire(new URL("./packages/db/package.json", import.meta.url)).resolve("pg"));
const pgProtocolCommonJs = fromPg.resolve("pg-protocol");
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_CACHED_DB ??= unusedPostgres;

export default defineConfig({
  // The Workers pool resolves a package's requires through the root server, so the fix for pg lives here.
  plugins: [{ name: "pg-protocol-commonjs", enforce: "pre", resolveId: (id: string) => (id === "pg-protocol" ? pgProtocolCommonJs : null) }],
  test: {
    reporters: [["default", { summary: false }]],
    // A change to one of these runs every test, in watch mode and under --changed (CI's pull requests): the inputs every
    // file is built on that no import reaches. Vitest's own defaults end in /**, which a changed file's path never matches.
    forceRerunTriggers: [
      "**/package.json",
      "**/{vitest,vite}.config.*",
      "**/pnpm-lock.yaml",
      "**/pnpm-workspace.yaml",
      "**/.node-version",
      "**/tsconfig*.json",
    ],
    projects: [
      {
        // Mirrors the path mapping in packages/sim/tsconfig.json.
        resolve: { alias: { "@japacity/content": contentEntry } },
        test: {
          name: "sim",
          environment: "node",
          include: ["packages/sim/src/**/*.test.ts"],
          exclude: PLAY_TESTS,
          setupFiles: ["packages/sim/vitest.setup.ts"],
          // Simulated play plays hundreds of months per property run.
          testTimeout: 60000,
        },
      },
      ...playProject,
      {
        test: {
          name: "content",
          environment: "node",
          include: ["packages/content/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "store",
          environment: "node",
          include: ["packages/store/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "db",
          environment: "node",
          include: ["packages/db/src/**/*.test.ts"],
          exclude: ["packages/db/src/race/**"],
        },
      },
      ...raceProject,
      {
        test: {
          name: "tools",
          environment: "node",
          include: ["tools/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", ...fixtureFolders],
        },
      },
      {
        // The city's asset pipeline: the kit, the palette, the builders (docs/rules/assets.md).
        test: {
          name: "models",
          environment: "node",
          include: ["packages/model-kit/src/**/*.test.ts", "models/**/*.test.ts"],
          exclude: ["**/node_modules/**"],
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["apps/server/src/**/*.test.ts"],
          exclude: ["**/node_modules/**", workersTests],
        },
      },
      {
        // The Workers runtime, for the place object (decision 0006 section 5). Sockets to a
        // Durable Object need one worker and no isolation: the plugin's known issue, linked there.
        plugins: [
          cloudflareTest({
            wrangler: { configPath: serverWrangler },
            miniflare: {
              bindings: { PLACE_CONFIG: JSON.stringify({ presence: { maxPerObject: 3 } }) },
            },
          }),
        ],
        test: {
          name: "server-workers",
          include: [workersTests],
          isolate: false,
          maxWorkers: 1,
          // One worker cannot share a group with the projects that run many, so this group runs after them.
          sequence: { groupOrder: 1 },
        },
      },
      {
        plugins: [react()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["apps/client/src/**/*.test.{ts,tsx}", "apps/client/vite/**/*.test.ts"],
        },
      },
      {
        // The teaser's composition, mounted frame by frame in a page as Remotion's player draws it.
        plugins: [react()],
        test: {
          name: "teaser",
          environment: "jsdom",
          include: ["apps/teaser/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
