// The dedication in a real browser (docs/rules/account.md R-ACCOUNT-032, R-ACCOUNT-033; city.md R-CITY-021 as amended
// 15 Oct 2026): the third light on the start screen's wire opens the page, its sheet lights a light of the player's own
// that hangs on the wire and stays on the device through a reload, "Put it out" removes it, and five taps on Settings'
// version line open the same page offline. Nothing about it is sent. Phone only: the design is drawn for a phone.
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { startReadyLife } from "./door";
import { LIVED, openApp, passHomeTeach, placeReady } from "./live";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
const PREVIEW = process.env.PREVIEW_DIR;

test.skip(({ isMobile }) => !isMobile, "The dedication is drawn for a phone.");

/** The pictures for the report, at 390 by 844 as the design's, named as the design's so the pairs can be compared. */
async function shoot(page: Page, name: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  await page.screenshot({ path: join(PREVIEW, `${name}.png`), fullPage: false });
}

test.beforeEach(async ({ page }) => {
  if (PREVIEW !== undefined && PREVIEW !== "") await page.setViewportSize({ width: 390, height: 844 });
});

/** The start screen against a faked server: never refused, signed out, the lights' counts as the design's picture has them. */
async function fakeStart(page: Page): Promise<string[]> {
  const sent: string[] = [];
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const key = `${request.method()} ${new URL(request.url()).pathname}`;
      sent.push(key);
      const answers: Record<string, { status: number; body: unknown }> = {
        "GET /api/age": { status: 200, body: { refused: false } },
        "GET /api/view": { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } },
        "GET /api/lights": { status: 200, body: { ok: true, home: 700, abroad: 150, back: 10 } },
      };
      const answer = answers[key] ?? { status: 404, body: { ok: false, code: "unknown-id", detail: "not faked" } };
      return route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body) });
    },
  );
  return sent;
}

const page_ = (page: Page) => page.getByRole("dialog", { name: "Dedication" });

test("[R-ACCOUNT-032] [R-ACCOUNT-033] the third light opens the dedication page; its sheet lights a light of the player's own on the wire and the page, kept through a reload, and Put it out removes it", async ({ page }) => {
  test.setTimeout(90_000);
  const sent = await fakeStart(page);
  await page.goto(`${ONLINE}/`);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 20_000 });
  const third = page.getByRole("button", { name: "A small light" });
  await expect(third).toBeVisible();
  // It says nothing until tapped: no words beside it.
  await expect(page.locator("[data-third-light]")).toHaveText("");
  // The scene and the counts settle before the picture.
  await expect(page.locator("[data-light-counts]")).toBeVisible();
  await page.waitForTimeout(1_200);
  await shoot(page, "01-start-day");
  // At night the rest of the scene takes the night's paint; the third light stays lit.
  await page.evaluate(() => {
    document.documentElement.dataset.paint = "night";
  });
  await page.waitForTimeout(600);
  await expect(page.locator("[data-dedication-glow='third']")).toBeVisible();
  await shoot(page, "01-start-night");
  await page.evaluate(() => {
    delete document.documentElement.dataset.paint;
  });

  const before = sent.length;
  await third.click();
  const dedication = page_(page);
  await expect(dedication).toBeVisible();
  await expect(dedication.getByText("soksonjr", { exact: true })).toBeVisible();
  await expect(dedication.getByText("Dedicated to my best friend, Osoko Emmanuel (July 1998 to June 2026). From Al-Ameen.", { exact: true })).toBeVisible();
  await expect(dedication.getByText("Sun re o.", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await shoot(page, "02-dedication-page");

  await dedication.getByRole("button", { name: "Light one for yours" }).click();
  const sheet = page.getByRole("dialog", { name: "Light one for yours" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("textbox", { name: "Their name" }).fill("Mama Nkechi");
  await sheet.getByRole("textbox", { name: "First year" }).fill("1951");
  await sheet.getByRole("textbox", { name: "Last year" }).fill("2024");
  await page.waitForTimeout(400);
  await shoot(page, "03-light-sheet");
  await sheet.getByRole("button", { name: "Light it" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(dedication.locator("[data-own-light-words]")).toHaveText("Mama Nkechi, 1951 to 2024");
  await expect(dedication.getByText("Kept on this phone only. Nobody else sees it.")).toBeVisible();
  await page.waitForTimeout(500);
  await shoot(page, "03-your-light");

  // Kept on the device only: nothing was sent while the page was open, and the light is in the device's own memory.
  expect(sent.slice(before)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("japacity.door.light"))).toBe(JSON.stringify({ name: "Mama Nkechi", from: 1951, to: 2024 }));

  await dedication.getByRole("button", { name: "Close" }).click();
  await expect(dedication).toHaveCount(0);
  const own = page.getByRole("button", { name: "Mama Nkechi, 1951 to 2024" });
  await own.click();
  await expect(page.locator("[data-own-light-name]")).toHaveText("Mama Nkechi, 1951 to 2024");
  await page.waitForTimeout(400);
  await shoot(page, "03-your-light-on-the-wire");

  // Through a reload, the light still hangs.
  await page.reload();
  await expect(page.getByRole("button", { name: "Mama Nkechi, 1951 to 2024" })).toBeVisible({ timeout: 20_000 });

  // Put it out, from the page.
  await page.getByRole("button", { name: "A small light" }).click();
  await page_(page).getByRole("button", { name: "Mama Nkechi, 1951 to 2024" }).click();
  await page_(page).getByRole("button", { name: "Put it out" }).click();
  await expect(page_(page).getByRole("button", { name: "Light one for yours" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("japacity.door.light"))).toBeNull();
  await page_(page).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Mama Nkechi, 1951 to 2024" })).toHaveCount(0);
});

test("[R-CITY-021] [R-ACCOUNT-032] five taps on Settings' version line open the dedication page, offline; four do not", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await placeReady(page);
  await passHomeTeach(page);
  const settings = await openApp(page, "settings");
  const version = settings.locator("[data-version] button");
  await version.scrollIntoViewIfNeeded();
  for (let tap = 0; tap < 4; tap += 1) await version.click();
  await expect(page_(page)).toHaveCount(0);
  await version.click();
  const dedication = page_(page);
  await expect(dedication).toBeVisible();
  await expect(dedication.getByText("soksonjr", { exact: true })).toBeVisible();
  await expect(dedication.getByText("Sun re o.", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await shoot(page, "02-dedication-page-from-settings");
  await dedication.getByRole("button", { name: "Close" }).click();
  await expect(dedication).toHaveCount(0);
  await expect(settings).toBeVisible();
});
