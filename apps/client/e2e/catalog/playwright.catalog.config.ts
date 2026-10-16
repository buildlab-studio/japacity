// The screen catalog (pnpm catalog): every screen of the game shot as a player sees it on a phone, laid out on one page
// for a look against CHECKLIST.md. A tool run by hand after a wave, never part of `pnpm test:browser` (that suite's
// config leaves this folder out) nor of `pnpm check`. Pixel 7 at three device pixels to each, WebGL drawn in software as
// world.spec.ts draws it, against the suite's two dev servers on their own ports. The pictures go outside the
// repository (where.ts); so does Playwright's own output.
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? "5179");
const ONLINE_PORT = Number(process.env.E2E_ONLINE_PORT ?? "5180");

export default defineConfig({
  testDir: ".",
  testMatch: "catalog.spec.ts",
  // The software renderer is heavy: a few lives at once, each its own part of the catalog.
  workers: Number(process.env.CATALOG_WORKERS ?? "3"),
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 900_000,
  reporter: [["list"]],
  outputDir: join(tmpdir(), "japacity-catalog-output"),
  globalSetup: "./setup.ts",
  globalTeardown: "./teardown.ts",
  use: {
    ...devices["Pixel 7"],
    deviceScaleFactor: Number(process.env.CATALOG_SCALE ?? "3"),
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "off",
    // A step that cannot be taken fails in seconds, so its screen is written down as not reached and the shoot goes on.
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: [
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
