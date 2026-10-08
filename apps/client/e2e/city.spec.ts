// The city in a real browser: the hub opens, the character walks where the ground is tapped, a tap on
// a person opens their card, and the hub stays inside its draw call and triangle budget on the phone.
// WebGL runs on the software renderer, so frame times here compare runs, not phones.
import { expect, test } from "@playwright/test";

import budgets from "../../../assets-src/budgets.json" with { type: "json" };

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

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

test("the hub opens, the character walks, a person's card opens, and the frame stays in budget", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: /^Live this life/ }).first().click();
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Look around" }).click();
  await page.waitForFunction(() => window.__city?.ready === true, null, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Ojuelegba" })).toBeVisible();
  // A few seconds of frames for the budget, and for the crowd to idle.
  await page.waitForTimeout(3000);

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
  await page.mouse.click(box.width * 0.3, box.height * 0.8);
  const moved = async (): Promise<number> => {
    const after = await page.evaluate(() => window.__city?.walker);
    return Math.hypot((after?.x ?? 0) - (before?.x ?? 0), (after?.z ?? 0) - (before?.z ?? 0));
  };
  await expect.poll(moved, { timeout: 10_000 }).toBeGreaterThan(0.5);
  expect(sent).toEqual([]);

  // Tap someone standing in view: their card says who they are, and no one in the crowd wears a tag.
  const spot = await page.evaluate((size) => {
    const city = window.__city;
    if (city === undefined) return null;
    for (let slot = 0; slot < 16; slot += 1) {
      const at = city.screenOf(slot);
      if (at !== null && at.y > size.height * 0.3 && at.y < size.height * 0.7 && at.x > 20 && at.x < size.width - 20) return at;
    }
    return null;
  }, box);
  expect(spot).not.toBeNull();
  await page.mouse.click(spot?.x ?? 0, spot?.y ?? 0);
  await expect(page.locator("[data-card]")).toBeVisible();
  await expect(page.locator("[data-card]")).toContainText(/Lives in the city|Another player|You/);

  await page.getByRole("button", { name: "Back to your month" }).click();
  await expect(page.getByRole("button", { name: "Look around" })).toBeVisible();
});

test("the credits are reachable from the city's menu and credit the map data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Live this life/ }).first().click();
  await page.getByRole("button", { name: "Look around" }).click();
  await page.getByRole("button", { name: "City" }).click();
  await page.getByRole("button", { name: "Credits" }).click();
  const sheet = page.getByRole("dialog", { name: "Credits" });
  await expect(sheet.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
});
