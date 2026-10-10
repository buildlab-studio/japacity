// The terms and the privacy notice in a real browser on a phone: both are
// plain pages beside the game, read without the game loading and without a
// sideways scroll, naming who runs the game from content's one constant.
import { OPERATOR } from "@japacity/content";
import { devices, expect, test } from "@playwright/test";

// A device's browser type can be chosen only by the project; the rest of the profile applies here.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

const PAGES = [
  { path: "/legal/terms.html", heading: "Terms of play", other: "Privacy notice" },
  { path: "/legal/privacy.html", heading: "Privacy notice", other: "Terms of play" },
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
  });
}
