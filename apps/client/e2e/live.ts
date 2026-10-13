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
    await page.locator(`[data-mark="${thing}"]`).click({ timeout: 10_000 });
    await chip.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await chip.locator(`[data-act="${act}"]`).click({ timeout: 10_000 });
}

/** An act from the fan that opens out of a thing whose acts are all now-acts (R-WORLD-034). */
export async function fanAct(page: Page, thing: string, activity: string): Promise<void> {
  const fan = page.locator(`[data-fan="${thing}"]`);
  // The fan's box is the point it opens from, with no size of its own: its buttons are what show.
  const button = fan.locator(`[data-fan-act="${activity}"] button`);
  for (let tries = 0; tries < 3 && !(await button.isVisible()); tries += 1) {
    await page.locator(`[data-mark="${thing}"]`).click({ timeout: 10_000 });
    await button.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  }
  await button.click({ timeout: 10_000 });
}

/** Into the home's room, where the bed stands, from the yard (R-WORLD-013); nothing when already inside. */
export async function intoTheRoom(page: Page): Promise<void> {
  if ((await page.locator('[data-mark="bed"]').count()) > 0) return;
  await doAct(page, "house", "enter");
  await page.locator('[data-mark="bed"]').waitFor({ state: "attached", timeout: 60_000 });
  await placeReady(page);
}

/**
 * The cards that stand over the world or over the results, each passed by its own button: a moment card (R-MOMENT-006: a
 * landing, a chapter done, a staged win) by its Close, a brief handed or a chapter closed by its Let's go (design page 13
 * section 4). True when one was passed.
 */
export async function passMomentCard(page: Page): Promise<boolean> {
  const card = page.locator("[data-moment-screen]").first();
  if (await card.isVisible().catch(() => false)) {
    await card.getByRole("button", { name: "Close" }).click();
    await card.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
    return true;
  }
  const brief = page.locator("[data-brief-close-go], [data-brief-go]").first();
  if (await brief.isVisible().catch(() => false)) {
    await brief.click();
    await brief.waitFor({ state: "detached", timeout: 5000 }).catch(() => undefined);
    return true;
  }
  return false;
}

/** Every card standing over the world passed, until none is left. */
export async function passCards(page: Page): Promise<void> {
  for (let passed = 0; passed < 6 && (await passMomentCard(page)); passed += 1) await page.waitForTimeout(300);
}

/** The staged moments that come before the results (R-WORLD-008), each passed in turn, until the results stand. */
export async function passMoments(page: Page, timeout = 30_000): Promise<void> {
  const results = page.locator("[data-world-sheet='results']");
  const ends = Date.now() + timeout;
  while (Date.now() < ends && !(await results.isVisible())) {
    if (!(await passMomentCard(page))) await page.waitForTimeout(250);
  }
}

/**
 * The bed's Sleep (R-WORLD-025): the first night's card says what sleep does once and is passed with its own Sleep; the
 * chip and Wake up stand while the sleep runs; when it runs out the month turns, and once the staged moments are passed
 * the results stand over the scene. Returns the results sheet.
 */
export async function sleepTheMonth(page: Page) {
  await passCards(page);
  await intoTheRoom(page);
  await doAct(page, "bed", "end-month");
  const firstNight = page.locator("[data-night-teach-ok]");
  if (await firstNight.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await firstNight.click();
  await passMoments(page);
  const results = page.locator("[data-world-sheet='results']");
  await expect(results).toBeVisible();
  // A moment card may come over the results a beat after them (R-MOMENT-006); passed, the results are read.
  await page.waitForTimeout(800);
  await passCards(page);
  return results;
}

/** Back from the results to the place (R-WORLD-008), past any moment card that came over them, and the band again. */
export async function backFromResults(page: Page): Promise<void> {
  const back = page.locator("[data-results-back]");
  for (let tries = 0; tries < 6 && (await back.count()) > 0; tries += 1) {
    await page.waitForTimeout(400);
    if (await passMomentCard(page)) continue;
    await back.click({ timeout: 3000 }).catch(() => undefined);
  }
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
