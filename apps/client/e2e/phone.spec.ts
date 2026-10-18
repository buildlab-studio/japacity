// The phone in a real browser at phone size (docs/rules/world.md R-WORLD-018): it rises over the
// world with the wallpaper and the apps, the Calendar first, grows and comes back, opens Bank, Chats, Japa and Papers,
// and still fits a small phone of 360 by 640. With PREVIEW_DIR set, each step is saved as a picture.
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { SOFTWARE_WEBGL } from "./support/browser";
import { startReadyLife } from "./support/door";
import { passCards } from "./support/live";

const PREVIEW = process.env.PREVIEW_DIR;

test.use({ launchOptions: SOFTWARE_WEBGL });

async function shot(page: Page, name: string): Promise<void> {
  if (PREVIEW !== undefined && PREVIEW !== "") await page.screenshot({ path: join(PREVIEW, `${name}.png`) });
}

/** Every motion of the interface has finished (each is under half a second: R-WORLD-023). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"), null, { timeout: 5_000 });
}

/** The handset and every tile sit inside the screen. */
async function expectInside(page: Page): Promise<void> {
  await settled(page);
  const screen = page.viewportSize() ?? { width: 0, height: 0 };
  const boxes = [await page.locator("[data-handset]").boundingBox(), ...(await Promise.all((await page.locator("[data-app]").all()).map((tile) => tile.boundingBox())))];
  for (const box of boxes) {
    expect(box).not.toBeNull();
    if (box === null) continue;
    expect(box.x).toBeGreaterThanOrEqual(-12);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(screen.width + 12);
    expect(box.y + box.height).toBeLessThanOrEqual(screen.height);
  }
}

test("[R-WORLD-018] [R-WORLD-019] the phone rises over the world, grows and comes back, opens Bank, Chats, Japa and Papers, and fits 360 by 640", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Pixel"), "phone size only");
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?world");
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  // The place behind the phone, when the software renderer gets there in time; the phone does not wait on it.
  // `window.__city` is declared by city.spec.ts.
  await page.waitForFunction(() => window.__city?.ready === true, null, { timeout: 60_000 }).catch(() => undefined);
  await passCards(page);
  await page.waitForTimeout(800);

  await page.locator('[data-thumb="phone"]').click();
  await expect(page.locator("[data-phone]")).toBeVisible();
  // The Calendar sits first among the apps since the month lives on the phone (R-WORLD-018), and the Market stands with
  // them for the things a life owns (decision 0019), so eleven.
  await expect(page.locator("[data-app]")).toHaveCount(11);
  await expect(page.locator('[data-app="market"]')).toHaveCount(1);
  await expect(page.locator("[data-app]").first()).toHaveAttribute("data-app", "calendar");
  await expect(page.locator("[data-phone-area]")).not.toBeEmpty();
  await page.waitForTimeout(500);
  await expectInside(page);
  await shot(page, "phone-01-grid");

  await page.getByRole("button", { name: "Make the phone bigger" }).click();
  await page.waitForTimeout(450);
  await expect(page.locator("[data-phone]")).toHaveAttribute("data-grown", "true");
  await shot(page, "phone-02-grown");
  await page.getByRole("button", { name: "Make the phone smaller" }).click();
  await page.waitForTimeout(450);

  await page.locator('[data-app="bank"]').click();
  await expect(page.locator('[data-phone-app="bank"]')).toBeVisible();
  await page.getByRole("button", { name: "Change money" }).click();
  await shot(page, "phone-03-bank");
  await page.locator('[data-go="change"]').click();
  await expect(page.locator("[data-ask-main]")).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "phone-04-bank-card");
  await page.locator("[data-ask-main]").click();
  // The phone's act is told in the corner over the handset, and goes after about seven seconds (R-WORLD-026).
  await expect(page.locator("[data-phone] [data-told]")).toHaveText("Money changed");
  await expect(page.locator("[data-phone] [data-told]")).toHaveCount(0, { timeout: 9_000 });
  await page.getByRole("button", { name: "Back" }).click();

  await page.locator('[data-app="chats"]').click();
  await page.locator('[data-chat-row="family"]').click();
  await expect(page.locator("[data-feed] li").first()).toBeVisible();
  await shot(page, "phone-05-chats");
  // One way back from the thread (R-WORLD-018): Back returns to the chats, then to the grid.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator('[data-chat-row="family"]')).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  await page.locator('[data-app="japa"]').click();
  await expect(page.locator('[data-phone-app="japa"]')).toBeVisible();
  await shot(page, "phone-06-japa");
  // The Papers app (R-WORLD-019): Japa's papers step opens Papers, the box under the bed on the phone.
  await page.locator("[data-open-papers]").click();
  await expect(page.locator('[data-app-screen="papers"]')).toBeVisible();
  await expect(page.getByText("The box under the bed", { exact: true })).toBeVisible();
  await shot(page, "phone-07-papers");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator('[data-app="papers"]')).toBeVisible();

  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(400);
  await expectInside(page);
  await shot(page, "phone-08-small-grid");

  await page.getByRole("button", { name: "Put the phone away" }).click();
  await expect(page.locator("[data-phone]")).toHaveCount(0);
});
