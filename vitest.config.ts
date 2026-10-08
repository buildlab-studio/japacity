import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Fixture folders hold files that look like tests on purpose. They are inputs
// to the tools' own tests and must never run as tests themselves.
const contentEntry = fileURLToPath(new URL("./packages/content/src/index.ts", import.meta.url));

const fixtureFolders = ["tools/lint-fixtures/**", "tools/__fixtures__/**"];

// The lock races need a real Postgres, so the db-race project is defined only
// when it is asked for by name: `pnpm vitest run --project db-race`.
const raceAsked = process.argv.some((arg, at, all) => arg === "--project=db-race" || (arg === "--project" && all[at + 1] === "db-race"));
const raceProject = raceAsked
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
          name: "assets",
          environment: "node",
          include: ["packages/assets/src/**/*.test.ts", "assets-src/**/*.test.ts"],
          exclude: ["**/node_modules/**"],
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["apps/server/src/**/*.test.ts"],
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
