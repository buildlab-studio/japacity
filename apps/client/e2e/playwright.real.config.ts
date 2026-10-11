// The real end-to-end tests (server.md R-SERVER-038): the client as the local Worker serves it,
// against Postgres and Mailpit in Docker Compose, nothing faked. Not in `pnpm test:browser` and not
// in `pnpm check`. Start the stack first with `pnpm dev:full`, then `pnpm test:browser:real`.
// `pnpm test:browser:real --staging` points it at staging instead, with the Access service token's
// headers from CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (tools/local/access.ts).
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { realTarget } from "../../../tools/local/access";
import { readLocalStack } from "../../../tools/local/env";

const stack = readLocalStack(fileURLToPath(new URL("../../..", import.meta.url)));
const target = realTarget(process.env, stack.siteUrl);

export default defineConfig({
  testDir: "./real",
  testMatch: "*.real.ts",
  // One life is played through the tests in order, on one database, under one address's limits.
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  timeout: 240_000,
  globalSetup: "./real/stack.setup.ts",
  use: {
    baseURL: target.baseUrl,
    // wrangler serves the local address with its own self-signed certificate; staging's is real.
    ignoreHTTPSErrors: target.local,
    // Staging's Access headers go on by route, to staging's origin alone (withAccess in tools/local/access.ts).
    // A trace keeps every request's headers, so none is written where the Access token travels.
    trace: target.local ? "retain-on-failure" : "off",
    // The world's scene needs WebGL, drawn in software where the machine has no GPU.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [{ name: "online-real", use: { ...devices["Pixel 7"] } }],
});
