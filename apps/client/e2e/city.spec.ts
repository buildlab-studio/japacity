// The city in a real browser: a street opens after the map's ride, the character walks where the ground is tapped, a tap
// on a person opens their card at the foot of the screen, and the street stays inside its draw call and triangle budget
// on the phone.
// WebGL runs on the software renderer, so frame times here compare runs, not phones.
import { expect, test } from "@playwright/test";

import budgets from "../../../assets-src/budgets.json" with { type: "json" };
import { SOFTWARE_WEBGL } from "./support/browser";
import { startReadyLife } from "./support/door";
import { LIVED, openApp, passCards, passHomeTeach, placeReady, rideTo } from "./support/live";

test.use({ launchOptions: SOFTWARE_WEBGL });

interface Probe {
  place: string;
  ready: boolean;
  drawCalls: number;
  triangles: number;
  frames: number[];
  walker: { x: number; z: number; target: unknown };
  people: number;
}

declare global {
  interface Window {
    __city?: Probe & { screenOf: (slot: number) => { x: number; y: number } | null };
  }
}

test("[city:residents-carry-no-tag] a street opens after a ride, the character walks where the ground is tapped, a person's card opens, and the frame stays in budget", async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await placeReady(page);
  await passHomeTeach(page);

  // Ojuelegba by the map's ride: the street opens with its name on the band (world:map-is-painted-lagos, world:ride-sheet-shows-fares).
  await rideTo(page, "place.ojuelegba");
  await expect(page.locator("[data-band] h2")).toHaveText("Ojuelegba");
  await passCards(page);
  // Enough frames for the budget, and for the crowd to idle; the software renderer may be slow under load.
  await page.waitForFunction(() => (window.__city?.frames.length ?? 0) > 10, null, { timeout: 60_000 });

  const probe = await page.evaluate(() => window.__city);
  expect(probe?.place).toBe("place.ojuelegba");
  if (info.project.name === "Pixel 7") {
    expect(probe?.drawCalls).toBeLessThanOrEqual(budgets.place.firstLoad.drawCalls);
    expect(probe?.triangles).toBeLessThanOrEqual(budgets.place.firstLoad.triangles);
  }
  const frames = probe?.frames ?? [];
  expect(frames.length).toBeGreaterThan(10);
  const sorted = [...frames].sort((a, b) => a - b);
  console.log(`${info.project.name}: ${String(probe?.drawCalls)} draw calls, ${String(probe?.triangles)} triangles, median frame ${String(sorted[Math.floor(sorted.length / 2)])} ms on the software renderer`);

  // Tap the ground to the side of the character: it walks there, and no command is sent.
  const before = probe?.walker;
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") sent.push(request.url());
  });
  const box = page.viewportSize() ?? { width: 400, height: 800 };
  const moved = async (): Promise<number> => {
    const after = await page.evaluate(() => window.__city?.walker);
    return Math.hypot((after?.x ?? 0) - (before?.x ?? 0), (after?.z ?? 0) - (before?.z ?? 0));
  };
  // A first tap may land on a thing's mark or a person; a few spots on open ground, until the character walks.
  for (const [fx, fy] of [[0.3, 0.75], [0.7, 0.75], [0.3, 0.6], [0.7, 0.6]] as const) {
    await page.mouse.click(box.width * fx, box.height * fy);
    if (await expect.poll(moved, { timeout: 4000 }).toBeGreaterThan(0.5).then(() => true, () => false)) break;
  }
  await expect.poll(moved, { timeout: 10_000 }).toBeGreaterThan(0.5);
  expect(sent).toEqual([]);

  // Tap someone standing in view: their card says who they are (city:residents-carry-no-tag). A person may stand behind a stall or a
  // sign, so each one in view is tried until a person's card opens.
  const spots = await page.evaluate((size) => {
    const city = window.__city;
    if (city === undefined) return [];
    return Array.from({ length: 16 }, (_, slot) => city.screenOf(slot)).filter(
      (at): at is { x: number; y: number } => at !== null && at.y > size.height * 0.2 && at.y < size.height * 0.8 && at.x > 20 && at.x < size.width - 20,
    );
  }, box);
  expect(spots.length).toBeGreaterThan(0);
  const card = page.locator("[data-card=person]");
  for (const spot of spots) {
    await page.mouse.click(spot.x, spot.y);
    if (await card.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) break;
  }
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Lives in the city|Another player/);

  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator("[data-band]")).toBeVisible();
});

test("[city:credits-screen-attributions] the credits are reachable from the phone's Settings and credit the map data", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await placeReady(page);
  await passHomeTeach(page);
  // The city has no menu of its own; its Credits stand in the phone's Settings (world:phone-rises-over-scene).
  const settings = await openApp(page, "settings");
  const row = settings.locator("[data-credits-row]");
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Credits" });
  await expect(sheet.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
});
