// The terms and the privacy notice in a real browser on a phone: both are
// plain pages beside the game at /terms and /privacy, read without the game
// loading and without a sideways scroll, naming who runs the game from
// content's one constant.
import { OPERATOR } from "@japacity/content";
import { devices, expect } from "@playwright/test";
import { test } from "./support/policy";

import { fakeServer, ONLINE, SIGNED_OUT } from "./support/api";

// A device's browser type can be chosen only by the project; the rest of the profile applies here.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

const PAGES = [
  { path: "/terms", heading: "Terms of play", other: "Privacy notice", otherPath: "/privacy" },
  { path: "/privacy", heading: "Privacy notice", other: "Terms of play", otherPath: "/terms" },
];

for (const legal of PAGES) {
  test(`the ${legal.heading.toLowerCase()} opens at phone size and fits the screen`, async ({ page }) => {
    const response = await page.goto(legal.path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name: legal.heading })).toBeVisible();
    await expect(page.getByText(`${OPERATOR.name}, ${OPERATOR.place}`, { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: OPERATOR.email }).first()).toBeVisible();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
    await page.getByRole("navigation").getByRole("link", { name: legal.other, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: legal.other })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(legal.otherPath);
  });

  test(`the ${legal.heading.toLowerCase()}'s .html address goes on to the clean one`, async ({ page }) => {
    await page.goto(`${legal.path}.html`);
    expect(new URL(page.url()).pathname).toBe(legal.path);
    await expect(page.getByRole("heading", { level: 1, name: legal.heading })).toBeVisible();
  });
}

test("the start screen's links open both pages at their clean addresses, beside the game", async ({ page, context }) => {
  // The online dev server (playwright.config.ts), where the start screen shows to a browser with no session.
  await fakeServer(page, { "GET /api/view": SIGNED_OUT });
  await page.goto(`${ONLINE}/`);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 20_000 });
  for (const legal of PAGES) {
    const opened = context.waitForEvent("page");
    await page.getByRole("navigation", { name: "Terms and privacy" }).getByRole("link", { name: legal.heading, exact: true }).click();
    const beside = await opened;
    await expect(beside.getByRole("heading", { level: 1, name: legal.heading })).toBeVisible();
    expect(new URL(beside.url()).pathname).toBe(legal.path);
    await beside.close();
  }
});
