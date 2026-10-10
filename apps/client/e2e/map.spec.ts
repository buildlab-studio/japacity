// The map and the ride in a real browser at phone size (docs/rules/world.md R-WORLD-015 to 017): the
// city drawn as the map stays within its draw calls by the renderer's own count, a stop picked lights
// the route and raises the ride sheet, and the ride plays and lands in the place. With MAP_SHOTS set
// to a folder, the pictures of each step are saved there.
import { expect, type Page, test } from "@playwright/test";
import { startReadyLife } from "./door";

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
  }
}

const SHOTS = process.env.MAP_SHOTS ?? null;

/** The city's own probe, as city.spec.ts declares it; only its place and readiness are read here. */
type CityProbe = { ready: boolean; place: string } | undefined;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS !== null) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** A new life in the world mode, played past its prologue by the first open answer each time. */
async function startLife(page: Page): Promise<void> {
  await page.goto("/?world");
  await startReadyLife(page);
  for (let step = 0; step < 40; step += 1) {
    if ((await page.locator("[data-band]").count()) > 0) break;
    const handover = page.locator("[data-page-handover] button");
    if ((await handover.count()) > 0) {
      await handover.first().click();
      break;
    }
    const start = page.getByRole("button", { name: /^Go$/ });
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

test("[R-WORLD-015] [R-WORLD-017] given a life at home on a phone, when the map opens and a stop is picked and ridden to, then the renderer counts at most 20 draw calls, the route runs between the two stops, and the ride lands there", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The map is measured at phone size");
  test.setTimeout(180_000);
  await startLife(page);
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout: 90_000 });
  const from = await page.evaluate(() => (window as unknown as { __city?: CityProbe }).__city?.place ?? "");

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

  // The ride: a short scene with its band and Skip, then the place opens with its name told in the corner (R-WORLD-026).
  await page.locator('[data-way="danfo"]').click();
  await page.locator("[data-ride-main]").click();
  await expect(page.locator("[data-ride]")).toBeVisible();
  await expect(page.locator("[data-ride-title]")).toContainText("Danfo to");
  await page.waitForTimeout(2600);
  await shot(page, "03-ride");
  await expect(page.locator("[data-ride]")).toBeHidden({ timeout: 8000 });
  await expect(page.locator("[data-corner] [data-told]").last()).toBeVisible();
  await page.waitForFunction((id) => (window as unknown as { __city?: CityProbe }).__city?.place === id, target, { timeout: 30_000 });
  await shot(page, "04-arrived");
});

test("[R-WORLD-032] given a life at home on a phone, when a danfo ride plays, then it cuts by itself from outside at the stop to above, the window and the seat, each once and in order, with no view switch", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The ride is watched at phone size");
  test.setTimeout(180_000);
  await startLife(page);
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout: 90_000 });
  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  await page.waitForFunction(() => (window.__map?.frames ?? 0) > 5, null, { timeout: 60_000 });
  const stops = (await page.evaluate(() => window.__map?.stops)) ?? [];
  const target = stops.find((stop) => stop.state !== "here" && stop.state !== "not" && stop.id !== "place.family-house")?.id ?? "";
  await page.locator(`[data-stop="${target}"]`).dispatchEvent("click");
  await expect(page.locator(`[data-ride-sheet="${target}"]`)).toBeVisible();
  await page.locator('[data-way="danfo"]').click();
  await page.locator("[data-ride-main]").click();
  await expect(page.locator("[data-ride]")).toBeVisible();
  // The card holds only Turn back and Skip: the ride picks its own angles.
  await expect(page.locator("[data-ride] button")).toHaveText(["Turn back", "Skip"]);
  // The probe goes with the ride, so its angles are read until it ends.
  let angles: string[] = [];
  let began = false;
  const seenOnScreen = new Set<string>();
  for (let poll = 0; poll < 400; poll += 1) {
    const now = await page.evaluate(() => {
      const probe = (window as unknown as { __ride?: { angle: string; angles: string[] } }).__ride;
      const shown = document.querySelector<HTMLElement>("[data-ride]")?.dataset.rideAngle ?? null;
      return probe === undefined ? null : { angles: [...probe.angles], shown };
    });
    if (now === null && began) break;
    if (now === null) {
      await page.waitForTimeout(50);
      continue;
    }
    began = true;
    angles = now.angles;
    if (now.shown !== null) seenOnScreen.add(now.shown);
    await page.waitForTimeout(50);
  }
  console.log(`ride angles: ${angles.join(", ")}`);
  expect(angles).toEqual(["outside", "above", "window", "seat"]);
  expect([...seenOnScreen]).toEqual(["outside", "above", "window", "seat"]);
  await expect(page.locator("[data-ride]")).toBeHidden({ timeout: 8000 });
});

test("[R-WORLD-016] given the map open on a phone, when a locked country in the dropdown is tapped, then it shakes and stays shut", async ({ page }, info) => {
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
