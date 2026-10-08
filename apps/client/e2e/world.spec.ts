// The world as the game, in a real browser at phone size (docs/rules/world.md R-WORLD-001 to 008,
// 024): the default address opens the world with the band and the two thumb buttons and nothing else;
// ?classic opens the old month page; End month opens the Month sheet; ending the month shows the
// results over the scene and goes back to the place; the nudge changes when an offer opens.
// With PREVIEW_DIR set, each step leaves a picture there.
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";

test.use({ viewport: { width: 390, height: 844 }, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

const PREVIEW = process.env.PREVIEW_DIR;

async function shoot(page: Page, name: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  await page.screenshot({ path: join(PREVIEW, `world-${name}-phone.png`), fullPage: false });
}

/** The phone-size checks run once, on the phone project. */
function phoneOnly(project: string): void {
  test.skip(project !== "Pixel 7", "The world is checked at phone size.");
}

/** Waits for the place to be drawn, so a picture shows it; the checks never depend on it. */
async function placeDrawn(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean } }).__city?.ready === true, null, { timeout: 90_000 }).catch(() => undefined);
}

async function startLife(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /^Live this life/ }).first().click();
  await expect(page.locator("[data-band]")).toBeVisible();
}

/** The staged wins and any card that opens over the world come before the results; each is closed in turn. */
async function passMoments(page: Page): Promise<void> {
  const results = page.locator("[data-world-sheet='results']");
  for (let step = 0; step < 6 && !(await results.isVisible()); step += 1) {
    const moment = page.locator("[data-moment]");
    if (await moment.isVisible()) await page.getByRole("dialog").getByRole("button").last().click();
    else await page.waitForTimeout(250);
  }
}

/** The names of the buttons a player can see over the place; the labels over things belong to the scene (R-WORLD-005). */
async function visibleButtons(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((button) => button.closest("[data-marks]") === null)
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const hidden = button.closest("[aria-hidden='true']") !== null || getComputedStyle(button).visibility === "hidden";
        return box.width > 0 && box.height > 0 && !hidden;
      })
      .map((button) => (button.getAttribute("aria-label") ?? button.textContent).trim()),
  );
}

/** Ada's recorded life one month in: ending the next month with nothing planned opens offers. */
function adaOneMonthIn(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, 1) }, clock: { anchor: 0 } });
}

test("[R-WORLD-001] [R-WORLD-024] the default address opens the world with the band and the two buttons and nothing else", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(120_000);
  await startLife(page);
  await expect(page.locator("[data-thumb='map']")).toBeVisible();
  await expect(page.locator("[data-thumb='phone']")).toBeVisible();
  await expect(page.locator("[data-nudge]")).toBeVisible();
  await placeDrawn(page);
  expect(await visibleButtons(page)).toEqual(["End month", "Map", "Phone"]);
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("[data-tab]")).toHaveCount(0);
  await shoot(page, "open");
});

test("[R-WORLD-024] ?classic opens the old month page with its header and tabs", async ({ page }, info) => {
  phoneOnly(info.project.name);
  await page.goto("/?classic");
  await page.getByRole("button", { name: /^Live this life/ }).first().click();
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("[data-band]")).toHaveCount(0);
});

test("[R-WORLD-007] [R-WORLD-008] End month opens the Month sheet; ending it shows the results over the scene, and the button goes back to the place", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(120_000);
  await startLife(page);
  await placeDrawn(page);
  const place = (await page.locator("[data-band] h2").textContent()) ?? "";

  await page.locator("[data-end-month]").click();
  const month = page.locator("[data-world-sheet='month']");
  await expect(month).toBeVisible();
  await expect(month.getByRole("heading", { name: "This month" })).toBeVisible();
  await expect(month.locator("[data-slot='free']").first()).toBeVisible();
  await expect(month.getByRole("button", { name: "Same again" })).toBeVisible();
  await expect(page.locator("[data-nudge]")).toHaveCount(0);
  await page.waitForTimeout(900);
  await shoot(page, "month");

  await month.locator("[data-month-end]").click();
  await passMoments(page);
  const results = page.locator("[data-world-sheet='results']");
  await expect(results).toBeVisible();
  await expect(results.getByRole("heading", { name: "Month 1 is done" })).toBeVisible();
  await expect(results.locator("[data-results-kept]")).toBeVisible();
  // The band and the thumb buttons step back while the results show.
  await expect(page.locator("[data-band]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-thumb-bar]")).toHaveAttribute("aria-hidden", "true");
  await page.waitForTimeout(600);
  await shoot(page, "results");

  await results.getByRole("button", { name: `Back to ${place}` }).click();
  await expect(results).toHaveCount(0);
  await expect(page.locator("[data-band]")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("[data-band]")).toContainText("Month 2");
  await expect(page.locator("[data-band] h2")).toHaveText(place);
});

test("[R-WORLD-003] the nudge changes when an offer opens, and a tap on it opens what is asked", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(120_000);
  await page.addInitScript((stored) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("japacity.save", stored);
      sessionStorage.setItem("seeded", "1");
    }
  }, adaOneMonthIn());
  await page.goto("/");
  const nudge = page.locator("[data-nudge]");
  await expect(nudge).toBeVisible();
  const before = (await nudge.textContent()) ?? "";
  expect(before).not.toBe("Someone is asking you something");

  await page.locator("[data-end-month]").click();
  await page.locator("[data-world-sheet='month'] [data-month-end]").click();
  await passMoments(page);
  await page.locator("[data-results-back]").click();
  await expect(nudge).toHaveText("Someone is asking you something");
  await placeDrawn(page);
  await shoot(page, "nudge-offer");

  await nudge.getByRole("button").click();
  const asks = page.locator("[data-world-sheet='asks']");
  await expect(asks).toBeVisible();
  await expect(asks.getByRole("listitem").first()).toBeVisible();
  await page.waitForTimeout(900);
  await shoot(page, "asks");
});
