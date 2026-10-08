// The gate's browser test at phone size: wrangler dev runs the gate on its own, in front of
// a stand-in game (game.ts), so the screen and the admit flow are seen as a phone sees them.
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

// Two worktrees running at once each pick their own ports through these.
const PORT = Number(process.env.GATE_E2E_PORT ?? "8790");
const GAME_PORT = Number(process.env.GATE_E2E_GAME_PORT ?? "8791");
/** A secret for this test only; the real one is set with `wrangler secret put` and never written down. */
export const E2E_SECRET = "e2e-only-secret";

const gateFolder = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  globalTeardown: "./cleanup.ts",
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "Pixel 7", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      command: "pnpm exec tsx e2e/game.ts",
      cwd: gateFolder,
      env: { GATE_E2E_GAME_PORT: String(GAME_PORT) },
      port: GAME_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: [
        "pnpm exec wrangler dev",
        `--port ${String(PORT)} --ip 127.0.0.1`,
        `--local-upstream 127.0.0.1:${String(GAME_PORT)} --upstream-protocol http`,
        `--var GATE_SECRET:${E2E_SECRET} --var GATE_X_HANDLE:japacityapp`,
        "--show-interactive-dev-session=false",
      ].join(" "),
      cwd: gateFolder,
      url: `http://127.0.0.1:${String(PORT)}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
