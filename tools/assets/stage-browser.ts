// Opens the stage in Playwright's own Chromium on the software renderer (decision 0005 section 3,
// point 4): no executablePath, so Playwright finds the build it installed, and SwiftShader, so a
// model gives the same pixels on every run.
import { text } from "@japacity/content";
import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";

import { ROOT } from "./catalog";
import { type Server, startServer } from "./serve";

/** A place's sign key: `place.<slug>.sign.<n>`. */
export const SIGN_KEY = /^place\.[a-z0-9-]+\.sign\.[a-z0-9-]+$/;

export const CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

export interface Stage {
  server: Server;
  browser: Browser;
  open: (viewport: { width: number; height: number; deviceScaleFactor: number }) => Promise<{ context: BrowserContext; page: Page }>;
  close: () => Promise<void>;
}

/** Every sign's words from the content's text table (city.md R-CITY-024), so a render shows what the game shows. */
export function signText(): Record<string, string> {
  return Object.fromEntries(Object.entries(text).filter(([key]) => SIGN_KEY.test(key)));
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
