// The world as the game, in a real browser at phone size (docs/rules/world.md R-WORLD-001 to 008, 024, 025, 030): the
// default address opens the world with the band and the two thumb buttons and nothing else, nothing under the band; ?classic
// opens the old month page; the band carries no Next month, its month opens the phone's Calendar; the month is lived and
// the bed's Sleep turns it, the results show over the scene and go back to the place; an ask waiting keeps its line under
// the band and a tap on it opens what is asked. With PREVIEW_DIR set, each step leaves a picture there.
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { lifeSaves } from "../../../packages/sim/src/goldens/lives.data";
import { passOpeningWords, startReadyLife } from "./door";
import { backFromResults, LIVED, passHomeTeach, placeNow, placeReady, putPhoneAway, seedSave, sleepTheMonth } from "./live";

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

async function startLife(page: Page): Promise<void> {
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible();
  await placeReady(page);
}

/**
 * The names of the buttons a player can see over the place. The marks and labels over things and the talk over the crowd
 * belong to the scene (R-WORLD-005, the talk budget of design page 13 section 5), and the nudge is checked on its own.
 */
async function visibleButtons(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((button) => button.closest("[data-marks], [data-mark], [data-speech], [data-nudge]") === null)
      .filter((button) => {
        const box = button.getBoundingClientRect();
        const hidden = button.closest("[aria-hidden='true']") !== null || getComputedStyle(button).visibility === "hidden";
        return box.width > 0 && box.height > 0 && !hidden;
      })
      .map((button) => (button.getAttribute("aria-label") ?? button.textContent).trim()),
  );
}

/** Ada's recorded life one month in: the acts sent at once before its first month's end, not the end itself, whose turn opens the life's first offer. */
function adaOneMonthIn(): string {
  const save = lifeSaves["ada-careful"];
  if (save === undefined) throw new Error("No recorded life ada-careful.");
  const firstEnd = save.commands.findIndex((entry) => entry.command.type === "turn/end");
  return JSON.stringify({ save: { ...save, commands: save.commands.slice(0, firstEnd) }, clock: { anchor: 0 } });
}

test("[R-WORLD-001] [R-WORLD-024] [R-WORLD-003] the default address opens the world with the band and the two buttons and nothing else, and nothing under the band", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(120_000);
  await startLife(page);
  await expect(page.locator("[data-thumb='map']")).toBeVisible();
  await expect(page.locator("[data-thumb='phone']")).toBeVisible();
  // The home says what it is once, on its first entry in a life (R-HOME-008); dismissed, nothing else stands over the place.
  await passHomeTeach(page);
  // The journey's step shows only in the moment (R-WORLD-003): nothing under the band by default.
  await expect(page.locator("[data-nudge]")).toHaveCount(0);
  // The band: the name over the age opens the data page (R-PROLOGUE-009; the name itself is that same button for a screen
  // reader), and the month's part of the day opens the Calendar (R-WORLD-002); then the two thumbs. No Next month: the
  // bed turns the month (R-WORLD-030).
  const buttons = await visibleButtons(page);
  const month = buttons.find((name) => /^[A-Z][a-z]+, (Morning|Afternoon|Evening|Night)\. Open the calendar$/.test(name));
  expect(month).toBeDefined();
  expect(buttons.sort()).toEqual(["Map", "Phone", "Your page", month ?? ""].sort());
  await expect(page.locator("[data-end-month]")).toHaveCount(0);
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("[data-tab]")).toHaveCount(0);
  await shoot(page, "open");
});

test("[R-WORLD-024] ?classic opens the old month page with its header and tabs", async ({ page }, info) => {
  phoneOnly(info.project.name);
  await page.goto("/?classic");
  await startReadyLife(page);
  await expect(page.getByRole("heading", { name: "Month 1", exact: true })).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("[data-band]")).toHaveCount(0);
});

test("[R-WORLD-002] [R-WORLD-007] [R-WORLD-008] [R-WORLD-025] [R-WORLD-030] the band's month opens the Calendar with nothing to end; the bed's Sleep turns the month, the results show over the scene, and the button goes back to the place a month older", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(150_000);
  await startLife(page);
  await passHomeTeach(page);
  const place = (await page.locator("[data-band] h2").textContent()) ?? "";
  const where = await placeNow(page);
  const monthBefore = (await page.locator("[data-band-month]").getAttribute("aria-label")) ?? "";
  const bandBefore = (await page.locator("[data-band]").textContent()) ?? "";

  // The Calendar: what carries on (R-WORLD-007), no Same again, no slot words, and nothing in it ends the month.
  await page.locator("[data-band-month]").click();
  const calendar = page.locator("[data-app-screen='calendar']");
  await expect(calendar).toBeVisible();
  await expect(calendar.locator("[data-calendar]").first()).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Same again" })).toHaveCount(0);
  await expect(calendar.getByRole("button", { name: /Next month|End month/ })).toHaveCount(0);
  await expect(calendar).not.toContainText(/slot|takes no/i);
  await expect(page.locator("[data-nudge]")).toHaveCount(0);
  await page.waitForTimeout(900);
  await shoot(page, "month");
  await putPhoneAway(page);

  // The bed's Sleep: the chip and Wake up while it runs, the month turns when it runs out (R-WORLD-025).
  const results = await sleepTheMonth(page);
  await expect(page.locator("[data-phone]")).toHaveCount(0);
  await expect(results.getByRole("heading", { name: "The month is done" })).toBeVisible();
  await expect(results.locator("[data-results-kept]")).toBeVisible();
  // The band and the thumb buttons step back while the results show.
  await expect(page.locator("[data-band]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-thumb-bar]")).toHaveAttribute("aria-hidden", "true");
  await page.waitForTimeout(600);
  await shoot(page, "results");

  await expect(results.locator("[data-results-back]")).toHaveText(new RegExp(`^Back to ${place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  await backFromResults(page);
  // The band's clock is the age, never a month number (R-WORLD-002): a month on, it reads one month older, in the next month.
  await expect(page.locator("[data-band]")).not.toHaveText(bandBefore);
  await expect(page.locator("[data-band]")).toContainText(/\d+ yrs \d+ mo/);
  await expect(page.locator("[data-band-month]")).not.toHaveAttribute("aria-label", monthBefore);
  await expect(page.locator("[data-band] h2")).toHaveText(place);
  expect(await placeNow(page)).toBe(where);
});

test("[R-WORLD-003] an ask waiting keeps its line under the band, and a tap on it opens what is asked", async ({ page }, info) => {
  phoneOnly(info.project.name);
  test.setTimeout(150_000);
  await seedSave(page, adaOneMonthIn());
  await page.goto(`/${LIVED}`);
  // A seeded session has no report yet, so the first chapter's title stands over the world for a moment (R-CHAPTER-011).
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  const nudge = page.locator("[data-nudge]");
  const line = async () => ((await nudge.count()) > 0 ? await nudge.textContent() : null);
  expect(await line()).not.toBe("Answer the person asking");

  // The recorded life's first offer opens within its first months; which month depends on the recording, so the test
  // sleeps months until the line turns to the ask, at most four.
  for (let month = 0; month < 4 && (await line()) !== "Answer the person asking"; month += 1) {
    await sleepTheMonth(page);
    await backFromResults(page);
  }
  await expect(nudge).toHaveText("Answer the person asking");
  await shoot(page, "nudge-offer");

  await nudge.getByRole("button").click();
  const asks = page.locator("[data-world-sheet='asks']");
  await expect(asks).toBeVisible();
  await expect(asks.getByRole("listitem").first()).toBeVisible();
  await page.waitForTimeout(900);
  await shoot(page, "asks");
});
