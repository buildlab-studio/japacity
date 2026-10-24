// A part of the client loaded on first use that cannot be fetched (world:lazy-part-fails-softly), in a real browser on a phone: the
// world stays with the connection card over it and Retry, never the broken screen; Retry or the connection coming back fetches
// it; and once the world is up the map is fetched ahead, so it opens with the connection gone. Against the dev server like
// the rest of the suite; for the production build, build the client with VITE_SERVER_URL at the online port and serve it
// there with `vite preview` before the run, and Playwright uses it in place of the dev server.
import { start } from "@japacity/sim/testing";

import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { content } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { clockAt, fakeServer, ONLINE, STANDING, viewReply } from "./support/api";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords } from "./support/door";
import { passCards, passHomeTeach, placeReady } from "./support/live";

test.use({ baseURL: ONLINE, launchOptions: SOFTWARE_WEBGL });

/** The painted map's own part, by its file's name in the dev server's paths and the build's chunk names alike. */
const MAP_PART = /PaperMap/;

async function onlineLife(page: Page): Promise<void> {
  const game = start({ scenario: "scenario.banker", content });
  game.grant(1);
  game.endTurn([]);
  await fakeServer(page, {
    "GET /api/view": { body: viewReply(game, clockAt(3).tick) },
    "GET /api/account": { body: { ok: true, account: accountView() } },
    "GET /api/moderation/standing": { body: STANDING },
  });
}

async function intoTheWorld(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  await page.goto("/");
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  await passCards(page);
}

test.describe("a part that cannot be fetched (world:lazy-part-fails-softly)", () => {
  test.beforeEach(({ browserName }, info) => {
    test.skip(info.project.name !== "Pixel 7" || browserName !== "chromium", "A phone's connection, in Chromium, which can be taken offline");
    test.setTimeout(180_000);
  });

  test("[world:lazy-part-fails-softly] given the map's part cannot be fetched, when the map is opened, then the world stays with the connection card, and Retry once it can be fetched opens the map", async ({ page }) => {
    await onlineLife(page);
    let blocked = true;
    await page.route(MAP_PART, (route) => (blocked ? route.abort("internetdisconnected") : route.fallback()));
    await intoTheWorld(page);
    await page.locator('[data-thumb="map"]').click();
    const card = page.locator('[data-trouble="network"][data-trouble-during="part"]');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-broken]")).toHaveCount(0);
    await expect(page.locator("[data-band]")).toBeVisible();

    blocked = false;
    await card.getByRole("button").first().click();
    await expect(page.locator("[data-map]")).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveCount(0);
    await expect(page.locator("[data-broken]")).toHaveCount(0);
  });

  test("[world:lazy-part-fails-softly] given the map's part failed for the connection, when the connection comes back, then the map opens with no tap", async ({ page, context }) => {
    await onlineLife(page);
    let blocked = true;
    await page.route(MAP_PART, (route) => (blocked ? route.abort("internetdisconnected") : route.fallback()));
    await intoTheWorld(page);
    await page.locator('[data-thumb="map"]').click();
    await expect(page.locator('[data-trouble="network"][data-trouble-during="part"]')).toBeVisible({ timeout: 20_000 });

    blocked = false;
    await context.setOffline(true);
    await context.setOffline(false);
    await expect(page.locator("[data-map]")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-trouble]")).toHaveCount(0);
  });

  test("[world:lazy-part-fails-softly] given the world is up, when the connection is idle, then the map is fetched ahead and opens after the connection is gone", async ({ page, context }) => {
    await onlineLife(page);
    const fetched = page.waitForResponse((response) => MAP_PART.test(response.url()) && response.ok(), { timeout: 60_000 });
    await intoTheWorld(page);
    await fetched;
    await page.route(MAP_PART, (route) => route.abort("internetdisconnected"));
    await context.setOffline(true);
    await page.locator('[data-thumb="map"]').click();
    await expect(page.locator("[data-map]")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-trouble]")).toHaveCount(0);
    await expect(page.locator("[data-broken]")).toHaveCount(0);
  });
});
