import { fileURLToPath } from "node:url";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Fixture folders hold files that look like tests on purpose. They are inputs
// to the tools' own tests and must never run as tests themselves.
const contentEntry = fileURLToPath(new URL("./packages/content/src/index.ts", import.meta.url));

const fixtureFolders = ["tools/lint-fixtures/**", "tools/__fixtures__/**"];

const serverWrangler = fileURLToPath(new URL("./apps/server/wrangler.jsonc", import.meta.url));
// The place object's tests open real sockets, which the Workers plugin runs only with shared storage.
const workersTests = "apps/server/src/**/*.workers.test.ts";
// Wrangler refuses a Hyperdrive binding without a local string; the place tests never connect to it.
const unusedPostgres = "postgres://test:test@127.0.0.1:5432/test";
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_GAME_DB ??= unusedPostgres;
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_CACHED_DB ??= unusedPostgres;

export default defineConfig({
  test: {
    reporters: [["default", { summary: false }]],
    projects: [
      {
        // Mirrors the path mapping in packages/sim/tsconfig.json.
        resolve: { alias: { "@japacity/content": contentEntry } },
        test: {
          name: "sim",
          environment: "node",
          include: ["packages/sim/src/**/*.test.ts"],
          // The sweep plays hundreds of months per property run.
          testTimeout: 60000,
        },
      },
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
          name: "tools",
          environment: "node",
          include: ["tools/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", ...fixtureFolders],
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
        // The Workers runtime, for the place object (decision 0004 section 5). Sockets to a
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
        },
      },
      {
        test: {
          name: "landing",
          environment: "node",
          include: ["apps/landing/src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["apps/client/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
