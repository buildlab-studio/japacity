// Browser tests at both sizes the game is built for: a mid-range Android
// phone and a desktop (docs/design/03-feasibility-and-plan.md, "Screens").
// Runs against the dev server, so the fast clock is on.
import { defineConfig, devices } from "@playwright/test";

// Two worktrees running at once each pick their own ports through these.
const PORT = Number(process.env.E2E_PORT ?? "5179");
/** The client built against a server, for online.spec.ts: the server is this same origin, every /api route faked by the spec. */
const ONLINE_PORT = Number(process.env.E2E_ONLINE_PORT ?? "5180");

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "Pixel 7", use: { ...devices["Pixel 7"] } },
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
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
