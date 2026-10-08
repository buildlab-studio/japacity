// The map and the ride in a real browser at phone size (docs/rules/world.md R-WORLD-015 to 017): the
// city drawn as the map stays within its draw calls by the renderer's own count, a stop picked lights
// the route and raises the ride sheet, and the ride plays and lands in the place. With MAP_SHOTS set
// to a folder, the pictures of each step are saved there.
import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

interface MapProbe {
  ready: boolean;
  drawCalls: number;
  triangles: number;
  frames: number;
  route: [number, number][] | null;
  stops: { id: string; state: string; at: [number, number] }[];
}

declare global {
  interface Window {
    __map?: MapProbe & { screenOf: (id: string) => { x: number; y: number } | null };
    __city?: { ready: boolean; place: string };
  }
}

const SHOTS = process.env.MAP_SHOTS ?? null;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS !== null) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** A new life in the world mode, played past its prologue by the first open answer each time. */
async function startLife(page: Page): Promise<void> {
  await page.goto("/?world");
  await page.getByRole("button", { name: /^Live this life/ }).first().click({ timeout: 30_000 });
  for (let step = 0; step < 40; step += 1) {
    if ((await page.locator("[data-band]").count()) > 0) break;
    const handover = page.locator("[data-prologue-handover] button");
    if ((await handover.count()) > 0) {
      await handover.first().click();
      break;
    }
    const start = page.getByRole("button", { name: /^Start month/ });
    if ((await start.count()) > 0) {
      await start.first().click();
      await page.waitForTimeout(400);
      continue;
    }
    const answer = page.locator("[data-answer] button:not([disabled])").first();
    await answer.waitFor({ timeout: 8000 });
    await answer.click();
    await page.waitForTimeout(250);
  }
  await page.waitForSelector("[data-band]", { timeout: 30_000 });
}

test("[R-WORLD-015] [R-WORLD-017] the map opens over the place within 20 draw calls, a stop lights its route, and the ride lands there", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The map is measured at phone size");
  test.setTimeout(180_000);
  await startLife(page);
  await page.waitForFunction(() => window.__city?.ready === true, null, { timeout: 90_000 });
  const from = await page.evaluate(() => window.__city?.place ?? "");

  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  await page.waitForFunction(() => (window.__map?.frames ?? 0) > 20, null, { timeout: 60_000 });
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => window.__map);
  console.log(`map: ${String(opened?.drawCalls)} draw calls, ${String(opened?.triangles)} triangles, ${String(opened?.stops.length)} stops`);
  expect(opened?.drawCalls).toBeGreaterThan(0);
  expect(opened?.drawCalls).toBeLessThanOrEqual(20);
  expect(opened?.stops.some((stop) => stop.state === "here" && stop.id === from)).toBe(true);
  await shot(page, "01-map-open");

  // Tap a stop's board on the screen: the route lights from the player's stop to it.
  // A stop a little way off, so the route has roads to run along.
  const away = (opened?.stops ?? []).filter((stop) => stop.state !== "here" && stop.state !== "not" && stop.id !== "place.family-house");
  const target = (away.find((stop) => stop.id === "place.national-stadium") ?? away[0])?.id ?? "";
  const board = await page.evaluate((id) => window.__map?.screenOf(id) ?? null, target);
  expect(board).not.toBeNull();
  await page.mouse.click(board?.x ?? 0, board?.y ?? 0);
  await expect(page.locator(`[data-ride-sheet="${target}"]`)).toBeVisible();
  await page.waitForTimeout(1500);
  const lit = await page.evaluate(() => window.__map);
  const here = lit?.stops.find((stop) => stop.state === "here");
  const there = lit?.stops.find((stop) => stop.id === target);
  expect(lit?.route?.[0]).toEqual(here?.at);
  expect(lit?.route?.[(lit.route.length || 1) - 1]).toEqual(there?.at);
  expect(lit?.drawCalls).toBeLessThanOrEqual(20);
  await expect(page.locator("[data-ride-main]")).toContainText("left");
  await shot(page, "02-stop-picked-route-lit");

  // The ride: a short scene with its band and Skip, then the place opens with a toast.
  await page.locator('[data-way="danfo"]').click();
  await page.locator("[data-ride-main]").click();
  await expect(page.locator("[data-ride]")).toBeVisible();
  await expect(page.locator("[data-ride-title]")).toContainText("Danfo to");
  await page.waitForTimeout(2600);
  await shot(page, "03-ride");
  await expect(page.locator("[data-ride]")).toBeHidden({ timeout: 8000 });
  await expect(page.locator("[data-toast]")).toBeVisible();
  await page.waitForFunction((id) => window.__city?.place === id, target, { timeout: 30_000 });
  await shot(page, "04-arrived");
});

test("[R-WORLD-016] the country dropdown lists the others locked, and a locked one stays shut", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The map is shown at phone size");
  test.setTimeout(120_000);
  await startLife(page);
  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  if (SHOTS !== null) {
    // Zoomed out: the whole city, the lagoon and the island.
    await page.waitForFunction(() => (window.__map?.frames ?? 0) > 10, null, { timeout: 60_000 });
    await page.mouse.move(195, 420);
    for (let notch = 0; notch < 6; notch += 1) await page.mouse.wheel(0, 300);
    await page.waitForTimeout(2500);
    await shot(page, "06-map-whole-city");
  }
  await page.locator("[data-country-menu] > button").click();
  const locked = page.locator('[data-country-option][data-locked="true"]').first();
  await locked.click({ force: true });
  await expect(locked).toHaveAttribute("data-shake", "true");
  await expect(page.locator("[data-country-menu] > button")).toHaveAttribute("data-country", "lagos");
  await shot(page, "05-country-locked");
});
