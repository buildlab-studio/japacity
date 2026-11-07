// The graphics mode and the door's pictures on a strong phone in a real browser (city:two-graphics-modes,
// prologue:front-door-three-screens): a sharp screen at three to one with memory to spare. Every WebGL draw from the first
// paint is read for the pixel ratio and antialiasing of the canvas it lands on: nothing draws in low on the way through
// the door, the city's first frame is high and the first place stays high once it has settled. On Where you live each
// home's picture has a picture pixel for every device pixel it covers.
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { content } from "../../../packages/content/src/index";
import { SOFTWARE_WEBGL } from "./support/browser";
import { giveName, passOpeningWords, passThePage } from "./support/door";

/** A large phone with a sharp screen: 430 by 932 CSS pixels at three to one, a coarse pointer. */
test.use({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

/** What a draw landed on: the canvas's pixels for each CSS pixel, its antialiasing, and whether it is the city's. */
interface Draw {
  ratio: number;
  antialias: boolean;
  city: boolean;
}

declare global {
  interface Window {
    __draws?: Draw[];
  }
}

/** The city's probe, as much of it as is read here. */
type City = { __city?: { ready?: boolean; frames: number[] } };

/** Every draw call's canvas, one record for each kind seen, kept in the order first seen. Canvases off the page (a still drawn to a picture) are left out. */
function watchDraws(): void {
  const seen = new Set<string>();
  const draws: Draw[] = [];
  window.__draws = draws;
  for (const kind of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const proto = kind.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = proto[name];
      if (typeof original !== "function") continue;
      proto[name] = function (this: WebGLRenderingContext, ...args: unknown[]) {
        const canvas = this.canvas;
        if (canvas instanceof HTMLCanvasElement && canvas.isConnected && canvas.clientWidth > 0) {
          const draw = { ratio: Math.round((canvas.width / canvas.clientWidth) * 100) / 100, antialias: this.getContextAttributes()?.antialias === true, city: canvas.closest("[data-city]") !== null };
          const key = JSON.stringify(draw);
          if (!seen.has(key)) {
            seen.add(key);
            draws.push(draw);
          }
        }
        return original.apply(this, args);
      };
    }
  }
}

async function draws(page: Page): Promise<Draw[]> {
  return page.evaluate(() => [...(window.__draws ?? [])]);
}

/** The dice for a name, Next, the developer, Next to Where you live. */
async function toWhereYouLive(page: Page): Promise<void> {
  await page.goto("/");
  await giveName(page);
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 30_000 });
  await page.getByRole("radio", { name: "The developer", exact: true }).click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.locator("[data-home-stack]").waitFor();
}

test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== "Pixel 7" || browserName !== "chromium", "A phone's screen, in the browser that reports its memory");
});

test("[city:two-graphics-modes] given a phone with a sharp screen and memory to spare, when it goes through the door into the first place, then nothing draws in low on the way, the city's first frame is high, and the place is still high once its first frames have settled", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(watchDraws);
  const high = { ratio: Math.min(3, content.tuning.city.maxPixelRatio), antialias: true };

  await toWhereYouLive(page);
  await page.getByRole("button", { name: /^Begin/ }).click();
  await passThePage(page);
  await page.waitForFunction(() => (window as unknown as City).__city?.ready === true, null, { timeout: 90_000 });
  const first = (await draws(page)).find((draw) => draw.city);
  expect(first).toEqual({ ...high, city: true });

  // The opening's words over the world, then the place's own frames past the first ones drawn.
  await passOpeningWords(page);
  await page.waitForFunction(() => ((window as unknown as City).__city?.frames.length ?? 0) >= 60, null, { timeout: 60_000 });
  const seen = await draws(page);
  expect(seen.filter((draw) => draw.ratio !== high.ratio || !draw.antialias)).toEqual([]);
  expect(seen.filter((draw) => draw.city)).toEqual([{ ...high, city: true }]);
});

test("[prologue:front-door-three-screens] given Where you live on a phone at three to one, then each home's picture, on the postcards and in the row, has a picture pixel for every device pixel it covers", async ({ page }) => {
  await toWhereYouLive(page);
  const pictures = page.locator("[data-home-picture]");
  await expect(pictures.first()).toBeVisible();
  const covered = await pictures.evaluateAll(async (all) =>
    Promise.all(
      all.map(async (element) => {
        const url = /url\("(.*)"\)/.exec(getComputedStyle(element).backgroundImage)?.[1];
        if (url === undefined) return null;
        const picture = new Image();
        picture.src = url;
        await picture.decode();
        const box = element as HTMLElement;
        // Drawn to cover its box: the larger of the two scales, times the screen's own pixels.
        const scale = Math.max(box.offsetWidth / picture.naturalWidth, box.offsetHeight / picture.naturalHeight) * window.devicePixelRatio;
        return { home: element.getAttribute("data-home-picture"), sharp: scale <= 1, scale: Math.round(scale * 100) / 100 };
      }),
    ),
  );
  const shown = covered.filter((one) => one !== null);
  expect(shown.length).toBeGreaterThanOrEqual(3);
  expect(shown.filter((one) => !one.sharp)).toEqual([]);
});
