// Every picture sharp on a sharp phone (prologue:front-door-three-screens, prologue:player-colours-on-looks,
// chapter:send-off-scene-in-beats): on a phone at three to one, each raster a screen shows, an image, a CSS background
// or a canvas, has at least one picture pixel for every device pixel it covers (e2e/support/rasters.ts). The screens are
// the ones that draw pictures large: the door's three steps and its page, the data page in the world, and every beat of
// the send-off in every country it lands in. The rest of the game draws its pictures as small tiles, which the screen
// catalog measures at every screen (CATALOG_RASTERS=1 pnpm catalog). The whole catalog takes minutes, so it is not here.
import { expect, type Page, test } from "@playwright/test";

import { content, text } from "../../../packages/content/src/index";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords, passThePage } from "./support/door";
import { closeGranted, LIVED, placeReady, seedSave } from "./support/live";
import { type Raster, rastersOnScreen } from "./support/rasters";
import { graduateBeforeFlight } from "./support/saves";

/** A large phone with a sharp screen: 430 by 932 CSS pixels at three to one, a coarse pointer. */
test.use({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, launchOptions: SOFTWARE_WEBGL });

/**
 * The one kind of picture allowed under one picture pixel a device pixel: the world's own WebGL canvases (the city and
 * the ride), drawn at the pixel ratio the graphics mode chose (city:two-graphics-modes): `high` at most
 * `tuning.city.maxPixelRatio`, which holds a three to one screen's fill to four ninths, and `low` at one. A canvas at
 * any other ratio, or any image or background over one, is soft.
 */
const ALLOWED_CANVAS_RATIOS = [Math.min(3, content.tuning.city.maxPixelRatio), 1];

function soft(rasters: readonly Raster[]): Raster[] {
  return rasters.filter((raster) => {
    if (raster.scale === null) return false;
    if (raster.kind === "canvas") return !ALLOWED_CANVAS_RATIOS.some((ratio) => Math.abs(raster.natural.width / raster.box.width - ratio) < 0.02);
    return raster.scale > 1;
  });
}

/**
 * Every image on the page decoded, each with the source its choice landed on, and every motion that ends has ended, so
 * each picture is measured at the size it rests at (world:motions-under-half-second).
 */
async function picturesIn(page: Page): Promise<void> {
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && (image.currentSrc !== "" || image.getAttribute("src") === null)));
  await page.waitForFunction(() => document.getAnimations().every((motion) => motion.playState !== "running" || motion.effect?.getTiming().iterations === Number.POSITIVE_INFINITY));
}

/** The soft pictures on the screen now, with the screen's name on each, so a failure says where. */
async function softOn(page: Page, screen: string): Promise<{ screen: string; source: string; where: string; scale: number | null }[]> {
  await picturesIn(page);
  const seen = await rastersOnScreen(page);
  expect(seen.length, `${screen} shows pictures`).toBeGreaterThan(0);
  return soft(seen).map((raster) => ({ screen, source: raster.source, where: raster.where, scale: raster.scale }));
}

test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== "Pixel 7" || browserName !== "chromium", "A phone's screen at three to one, in the browser the suite draws WebGL in");
});

test("[prologue:front-door-three-screens] given a phone at three to one, when the door is walked through every life and every home to the page, then every picture has a picture pixel for each device pixel it covers", async ({ page }) => {
  test.setTimeout(120_000);
  const found: Awaited<ReturnType<typeof softOn>> = [];
  await page.goto("/");
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout: 30_000 });
  await page.locator("[data-figure]").first().waitFor();
  found.push(...(await softOn(page, "You")));

  await page.getByRole("button", { name: /^Next/ }).first().click();
  const lives = page.locator("[data-gate='life'] [role='radio']");
  await lives.first().waitFor();
  for (let at = 0; at < (await lives.count()); at += 1) {
    await lives.nth(at).click();
    found.push(...(await softOn(page, `Your life so far, life ${String(at + 1)}`)));
  }
  await page.getByRole("radio", { name: "The developer", exact: true }).click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.locator("[data-home-stack]").waitFor();
  const homes = page.locator("[data-home]");
  for (let at = 0; at < (await homes.count()); at += 1) {
    await homes.nth(at).click();
    found.push(...(await softOn(page, `Where you live, home ${String(at + 1)}`)));
  }
  await page.locator("[data-home='family-house']").first().click();
  await page.getByRole("button", { name: /^Begin/ }).click();
  await page.locator("[data-photo-made]").waitFor({ timeout: 30_000 });
  found.push(...(await softOn(page, "The page")));
  await passThePage(page);
  expect(found).toEqual([]);
});

test("[prologue:player-colours-on-looks] given a life opened on a phone at three to one with no person kept on it, when the page opens from the band, then its photo is drawn and every picture on it is sharp", async ({ page }) => {
  test.setTimeout(120_000);
  await seedSave(page, graduateBeforeFlight());
  await page.goto(`/${LIVED}`);
  await closeGranted(page);
  await placeReady(page);
  await passOpeningWords(page);
  await page.getByRole("button", { name: text["prologue.page.open"] ?? "Your page" }).first().click();
  await page.locator("[data-photo-made]").waitFor({ timeout: 30_000 });
  expect(await softOn(page, "Your page")).toEqual([]);
});

type SendOffHook = { getState: () => { open: (flight: { route: string; country: string }) => void; to: (beat: string) => void; close: () => void } };

/** A route to each country the send-off lands in, so every landing and ride is drawn. */
const FLIGHTS = [
  { route: "route.uk-masters", country: "country.uk" },
  { route: "route.canada-points", country: "country.canada" },
  { route: "route.gulf-contract", country: "country.uae" },
  { route: "route.road", country: "country.italy" },
] as const;

test("[chapter:send-off-scene-in-beats] [prologue:front-door-three-screens] given a phone at three to one, when every beat of the send-off is drawn for every country it lands in, then every sticker on it is sharp", async ({ page }) => {
  test.setTimeout(240_000);
  await seedSave(page, graduateBeforeFlight());
  await page.goto(`/${LIVED}`);
  await closeGranted(page);
  await placeReady(page);
  const scene = page.locator("[data-send-off]");
  const found: Awaited<ReturnType<typeof softOn>> = [];
  for (const flight of FLIGHTS) {
    await page.evaluate((one) => {
      const hook = (window as unknown as { __sendOff?: SendOffHook }).__sendOff;
      if (hook === undefined) throw new Error("The send-off hook is not on the window.");
      hook.getState().open(one);
    }, flight);
    for (const beat of ["departures", "counter", "gate", "plane", "landing", "ride"]) {
      await page.evaluate((to) => (window as unknown as { __sendOff?: SendOffHook }).__sendOff?.getState().to(to), beat);
      await expect(scene).toHaveAttribute("data-send-off", beat);
      await scene.locator("[data-so-tile]").first().waitFor();
      found.push(...(await softOn(page, `${flight.country} ${beat}`)));
    }
    await page.evaluate(() => (window as unknown as { __sendOff?: SendOffHook }).__sendOff?.getState().close());
    await expect(scene).toHaveCount(0);
  }
  expect(found).toEqual([]);
});
