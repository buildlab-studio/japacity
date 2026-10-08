// Opens the stage in Playwright's own Chromium on the software renderer (decision 0005 section 3,
// point 4): no executablePath, so Playwright finds the build it installed, and SwiftShader, so a
// model gives the same pixels on every run.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

import { ROOT, SOURCE } from "./catalog";
import { type Server, startServer } from "./serve";

export const CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export interface Stage {
  server: Server;
  browser: Browser;
  open: (viewport: { width: number; height: number; deviceScaleFactor: number }) => Promise<{ context: BrowserContext; page: Page }>;
  close: () => Promise<void>;
}

export function signText(): Record<string, string> {
  return (JSON.parse(readFileSync(join(SOURCE, "signs.json"), "utf8")) as { text: Record<string, string> }).text;
}

export async function openStage(): Promise<Stage> {
  const server = await startServer(ROOT);
  const browser = await chromium.launch({ args: CHROMIUM_ARGS });
  return {
    server,
    browser,
    open: async (viewport) => {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
      const page = await context.newPage();
      page.on("pageerror", (error) => {
        console.log(`stage error: ${error.message}`);
      });
      page.on("console", (message) => {
        if (message.type() === "error") console.log(`stage console: ${message.text()}`);
      });
      await page.goto(`${server.url}/assets-src/stage/stage.html`);
      await page.waitForFunction("window.stageReady === true", null, { timeout: 60_000 });
      return { context, page };
    },
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}
