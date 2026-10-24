// The pictures shipped light (assets:pictures-shipped-light): on a phone at three to one with nothing cached, the online
// start screen and the offline door's first screen each fetch their pictures inside a budget, and no PNG from the
// published assets. Many players come on mobile data, so the first screen's pictures are most of what a first visit
// waits for. Every image response is counted, the published ones and the client's own, by the bytes of its body.
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { ONLINE, SIGNED_OUT, fakeServer } from "./support/api";

/** A large phone with a sharp screen: 430 by 932 CSS pixels at three to one, a coarse pointer. */
test.use({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

/** The rule's two budgets, in bytes (a KB is 1000 bytes). */
const START_SCREEN_BYTES = 150_000;
const DOOR_FIRST_SCREEN_BYTES = 250_000;

interface Fetched {
  url: string;
  bytes: number;
}

/** Every image the page fetches from now on, with the bytes of its body. */
function watchPictures(page: Page): { fetched: Fetched[]; done: () => Promise<void> } {
  const fetched: Fetched[] = [];
  const reading: Promise<void>[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() !== "image") return;
    reading.push(
      response
        .body()
        .then((body) => {
          fetched.push({ url: new URL(response.url()).pathname, bytes: body.byteLength });
        })
        .catch(() => undefined),
    );
  });
  return { fetched, done: async () => void (await Promise.all(reading)) };
}

/** Every image on the page decoded and nothing more on its way. */
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
}

function total(fetched: readonly Fetched[]): number {
  return fetched.reduce((sum, one) => sum + one.bytes, 0);
}

/** The pictures fetched, largest first, so a failure says which weigh most. */
function listed(fetched: readonly Fetched[]): string {
  return [...fetched]
    .sort((a, b) => b.bytes - a.bytes)
    .map((one) => `${String(one.bytes)} ${one.url}`)
    .join("\n");
}

const pngFromAssets = (fetched: readonly Fetched[]): string[] => fetched.filter((one) => one.url.includes("/assets/") && one.url.endsWith(".png")).map((one) => one.url);

test.beforeEach(({ browserName }, info) => {
  test.skip(info.project.name !== "Pixel 7" || browserName !== "chromium", "A phone's screen at three to one, counted once");
});

test("[assets:pictures-shipped-light] [account:start-screen-over-live-city] given a phone at three to one with nothing cached, when the online start screen shows signed out over the city, then its pictures weigh at most 150 KB and none is a PNG from the published assets", async ({ page }) => {
  test.setTimeout(90_000);
  await fakeServer(page, { "GET /api/view": SIGNED_OUT, "GET /api/age": { body: { refused: false } } });
  const pictures = watchPictures(page);
  await page.goto(ONLINE);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-start-city] img").first().waitFor({ timeout: 30_000 });
  await settled(page);
  await pictures.done();
  const bytes = total(pictures.fetched);
  console.log(`start screen: ${String(pictures.fetched.length)} pictures, ${String(bytes)} bytes\n${listed(pictures.fetched)}`);
  expect(pngFromAssets(pictures.fetched)).toEqual([]);
  expect(bytes, listed(pictures.fetched)).toBeLessThanOrEqual(START_SCREEN_BYTES);
});

test("[assets:pictures-shipped-light] [prologue:front-door-three-screens] given a phone at three to one with nothing cached, when the offline door's first screen shows, then its pictures weigh at most 250 KB and none is a PNG from the published assets", async ({ page }) => {
  test.setTimeout(90_000);
  const pictures = watchPictures(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout: 30_000 });
  await page.locator("[data-figure]").first().waitFor();
  await page.locator("[data-face-sticker] img").first().waitFor();
  await settled(page);
  await pictures.done();
  const bytes = total(pictures.fetched);
  console.log(`door, first screen: ${String(pictures.fetched.length)} pictures, ${String(bytes)} bytes\n${listed(pictures.fetched)}`);
  expect(pngFromAssets(pictures.fetched)).toEqual([]);
  expect(bytes, listed(pictures.fetched)).toBeLessThanOrEqual(DOOR_FIRST_SCREEN_BYTES);
});
