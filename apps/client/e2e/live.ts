// The month lived by hand in a browser test (docs/rules/world.md R-WORLD-025, R-WORLD-030; decision 0036): the bed's
// Sleep turns the month, the results open over the scene, and Back returns to the place. The address's `?sleep=<seconds>`
// shortens the sleep and `?morning=now` opens every sealed result at once (R-CLOCK-032), both read by a development build
// only, which the suite's server is. The phone's apps are opened from the Phone thumb.
import { expect, type Page } from "@playwright/test";

/** The address a test opens: the sleep cut to two seconds and the morning's results opened at once. */
export const LIVED = "?sleep=2&morning=now";

/** The probe the scene sets on the window; only its place and readiness are read here. */
type CityProbe = { ready?: boolean; place?: string } | undefined;

/** Waits for the place to be drawn, so its things can be tapped. */
export async function placeReady(page: Page, timeout = 90_000): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __city?: CityProbe }).__city?.ready === true, null, { timeout });
}

/** The place the scene stands in. */
export async function placeNow(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __city?: CityProbe }).__city?.place ?? "");
}

/** The home's teach card, shown once on the first entry into the home in a life (R-HOME-008), dismissed so the place is clear. */
export async function passHomeTeach(page: Page, timeout = 4000): Promise<void> {
  const teach = page.locator("[data-home-teach-ok]");
  if (await teach.waitFor({ state: "visible", timeout }).then(() => true, () => false)) await teach.click();
}

/** A thing's act from the chip that floats over it once its mark is tapped (R-WORLD-005). */
export async function doAct(page: Page, thing: string, act: string): Promise<void> {
  const chip = page.locator(`[data-thing-chip="${thing}"]`);
  for (let tries = 0; tries < 3 && !(await chip.isVisible()); tries += 1) {
    await page.locator(`[data-mark="${thing}"]`).click();
    await chip.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await chip.locator(`[data-act="${act}"]`).click();
}

/** Into the home's room, where the bed stands, from the yard (R-WORLD-013); nothing when already inside. */
export async function intoTheRoom(page: Page): Promise<void> {
  if ((await page.locator('[data-mark="bed"]').count()) > 0) return;
  await doAct(page, "house", "enter");
  await page.locator('[data-mark="bed"]').waitFor({ state: "attached", timeout: 60_000 });
  await placeReady(page);
}

/** The staged wins and any card that opens over the world before the results; each is passed in turn (R-WORLD-008). */
export async function passMoments(page: Page, timeout = 30_000): Promise<void> {
  const results = page.locator("[data-world-sheet='results']");
  const ends = Date.now() + timeout;
  while (Date.now() < ends && !(await results.isVisible())) {
    const moment = page.locator("[data-moment]");
    if (await moment.isVisible().catch(() => false)) await page.getByRole("dialog").getByRole("button").last().click();
    else await page.waitForTimeout(250);
  }
}

/**
 * The bed's Sleep (R-WORLD-025): the first night's card says what sleep does once and is passed with its own Sleep; the
 * chip and Wake up stand while the sleep runs; when it runs out the month turns, and once the staged moments are passed
 * the results stand over the scene. Returns the results sheet.
 */
export async function sleepTheMonth(page: Page) {
  await intoTheRoom(page);
  await doAct(page, "bed", "end-month");
  const firstNight = page.locator("[data-night-teach-ok]");
  if (await firstNight.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await firstNight.click();
  await passMoments(page);
  const results = page.locator("[data-world-sheet='results']");
  await expect(results).toBeVisible();
  return results;
}

/** Back from the results to the place (R-WORLD-008), and the band again. */
export async function backFromResults(page: Page): Promise<void> {
  await page.locator("[data-results-back]").click();
  await expect(page.locator("[data-world-sheet='results']")).toHaveCount(0);
  await expect(page.locator("[data-band]")).toHaveAttribute("aria-hidden", "false");
}

/** The phone from its thumb, on an app (R-WORLD-018); the app's screen is returned. */
export async function openApp(page: Page, app: string) {
  if ((await page.locator("[data-phone]").count()) === 0) await page.locator('[data-thumb="phone"]').click();
  const back = page.locator("[data-phone-back]");
  if (await back.isVisible().catch(() => false)) await back.click();
  await page.locator(`[data-app="${app}"]`).click();
  const screen = page.locator(`[data-app-screen="${app}"]`);
  await expect(screen).toBeVisible();
  return screen;
}

/** The phone put away by its home bar. */
export async function putPhoneAway(page: Page): Promise<void> {
  await page.locator("[data-home-bar]").click();
  await expect(page.locator("[data-phone]")).toHaveCount(0);
}

/** A save handed to the client once per tab, so a reload keeps what was played since (the local authority replays it). */
export async function seedSave(page: Page, stored: string): Promise<void> {
  await page.addInitScript((save) => {
    if (sessionStorage.getItem("seeded") === null) {
      localStorage.setItem("japacity.save", save);
      sessionStorage.setItem("seeded", "1");
    }
  }, stored);
  // The device marked as played (R-WORLD-033), so no first-use label stands at the thumbs.
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
}
