// Back on a phone (world:back-closes-topmost): the browser's Back closes the topmost thing the player opened, one at a time, at
// the same address: a ride's sheet and then the map; a sheet, the app under it and then the phone. Before Begin, Back at the age
// screen returns to the start screen, and an age already answered is not asked again on the way back in.
import { standInWorld } from "@japacity/sim";
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { content } from "../../../packages/content/src/index";
import { clockAt, fakeServer, ONLINE, SIGNED_OUT } from "./support/api";
import { SOFTWARE_WEBGL } from "./support/browser";
import { startReadyLife } from "./support/door";
import { passCards } from "./support/live";

test.use({ launchOptions: SOFTWARE_WEBGL });

/** Every motion of the interface has finished (each is under half a second: world:motions-under-half-second). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity), null, { timeout: 5_000 });
}

/** The history entries the game has added above the page's own. */
async function depth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const value = (history.state as Record<string, unknown> | null)?.japacityBack;
    return typeof value === "number" ? value : 0;
  });
}

async function back(page: Page): Promise<void> {
  await page.goBack({ waitUntil: "commit" });
  await settled(page);
}

test("[world:back-closes-topmost] on a phone, Back closes a ride's sheet and then the map, then a sheet, the app under it and then the phone, one at a time, and the address never changes", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Pixel"), "phone size only");
  test.setTimeout(180_000);
  await page.goto("/");
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean } }).__city?.ready === true, null, { timeout: 60_000 }).catch(() => undefined);
  await passCards(page);
  await page.waitForTimeout(800);
  await expect.poll(() => depth(page)).toBe(0);
  const address = new URL(page.url()).pathname;

  // The map, then a stop's ride sheet over it.
  await page.locator('[data-thumb="map"]').click();
  await expect(page.locator("[data-map]")).toBeVisible();
  const stop = await page.locator("[data-stop][data-state='can'], [data-stop][data-state='been']").first().getAttribute("data-stop");
  if (stop === null) throw new Error("No stop to ride to.");
  await page.evaluate((id) => document.querySelector<HTMLButtonElement>(`[data-stop="${id}"]`)?.click(), stop);
  await expect(page.locator(`[data-ride-sheet="${stop}"]`)).toBeVisible();
  await expect.poll(() => depth(page)).toBe(2);
  await back(page);
  await expect(page.locator("[data-ride-sheet]")).toHaveCount(0);
  await expect(page.locator("[data-map]")).toBeVisible();
  await back(page);
  await expect(page.locator("[data-map]")).toHaveCount(0);
  await expect(page.locator("[data-band]")).toBeVisible();

  // The phone, Bank on it, then the change-money sheet over Bank.
  await page.locator('[data-thumb="phone"]').click();
  await expect(page.locator("[data-phone]")).toBeVisible();
  await page.locator('[data-app="bank"]').click();
  await expect(page.locator('[data-app-screen="bank"]')).toBeVisible();
  await page.getByRole("button", { name: "Change money" }).click();
  await page.locator('[data-go="change"]').click();
  await expect(page.locator("[data-ask-main]")).toBeVisible();
  await settled(page);
  await back(page);
  await expect(page.locator("[data-ask-main]")).toHaveCount(0);
  await expect(page.locator("[data-phone]")).toBeVisible();
  // Change money is an inner screen of Bank: Back takes it first, then Bank, then the phone.
  for (let step = 0; step < 3 && (await page.locator('[data-app-screen="bank"]').count()) > 0; step += 1) await back(page);
  await expect(page.locator('[data-app-screen="bank"]')).toHaveCount(0);
  await expect(page.locator("[data-phone-home]")).toBeVisible();
  await back(page);
  await expect(page.locator("[data-phone]")).toHaveCount(0);
  await expect(page.locator("[data-band]")).toBeVisible();
  expect(await depth(page)).toBe(0);
  expect(new URL(page.url()).pathname).toBe(address);
});

test.describe("before Begin", () => {
  test.use({ baseURL: ONLINE });

  const CLOCK = clockAt(3);

  async function signedOut(page: Page): Promise<void> {
    await fakeServer(page, {
      "GET /api/age": { body: { refused: false } },
      "POST /api/age": { body: { ok: true } },
      "GET /api/username/available": { body: { ok: true, free: true } },
      "GET /api/view": SIGNED_OUT,
      "GET /api/world": { body: { tick: CLOCK.tick, world: standInWorld("world-1", CLOCK.tick, content), nextTickAt: CLOCK.nextTickAt } },
    });
  }

  test("[world:back-closes-topmost] Back at the age screen returns to the start screen; with the age answered, Back from the door returns to the start screen and Play goes on to the door without asking again", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("Pixel"), "phone size only");
    test.setTimeout(120_000);
    await signedOut(page);
    await page.goto("/");
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeVisible({ timeout: 20_000 });

    await play.click();
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
    await back(page);
    await expect(play).toBeVisible();
    await expect(page.getByRole("heading", { name: "When were you born?" })).toHaveCount(0);

    await play.click();
    await page.getByRole("combobox", { name: "Day" }).selectOption("12");
    await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "March" });
    await page.getByRole("combobox", { name: "Year" }).selectOption("1994");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("textbox", { name: "Your name" })).toBeVisible({ timeout: 20_000 });
    await back(page);
    await expect(play).toBeVisible();
    await play.click();
    await expect(page.getByRole("textbox", { name: "Your name" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "When were you born?" })).toHaveCount(0);
  });
});
