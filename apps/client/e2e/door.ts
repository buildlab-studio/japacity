// The way through the front door for a browser test (prologue.md R-PROLOGUE-009): past the look with Next, then a
// ready life by its kind (the first one when none is named) or an archetype's tile, a name, the page and Begin.
import type { Page } from "@playwright/test";

/** The first-play walkthrough is for a person, once per device (R-WORLD-027); a test marks it seen so its pointers never cover the band. */
async function skipWalkthrough(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem("japacity.walkthrough", "1"));
}

/**
 * The chapter's opening words stand over the world once (R-WORLD-001); Go takes them away and takes the
 * step, which opens the map with the stop picked. A test that wants the world as it stands closes that map.
 * The classic page has no opening words, so the wait is short.
 */
export async function passOpeningWords(page: Page, timeout = 4_000): Promise<void> {
  const go = page.locator("[data-opening-go]");
  await go.waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (!(await go.isVisible())) return;
  await go.click();
  const close = page.locator("[data-map-close]");
  await close.waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (await close.isVisible()) await close.click();
}

/** The name: the first the pool suggests; then "Print my page", and Begin, which stamps the page and starts the life. */
async function nameAndBegin(page: Page, timeout: number): Promise<void> {
  await page.getByRole("group", { name: "Names to take" }).getByRole("button").first().click({ timeout });
  await page.getByRole("button", { name: /^Print my page/ }).click({ timeout });
  await page.getByRole("button", { name: /^Begin/ }).click({ timeout });
  await page.locator("[data-door-progress]").waitFor({ state: "detached", timeout });
}

/** Next, "Start from a ready life", Pick on the kind named, else the first ready life; a name, the page, Begin; then past the opening words. */
export async function startReadyLife(page: Page, kind?: string, timeout = 30_000): Promise<void> {
  await skipWalkthrough(page);
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  await page.getByRole("button", { name: /^Start from a ready life/ }).first().click({ timeout });
  const pick = kind === undefined ? page.getByRole("button", { name: /^Pick: / }).first() : page.getByRole("button", { name: `Pick: ${kind}` });
  await pick.click({ timeout });
  await nameAndBegin(page, timeout);
  await passOpeningWords(page);
}

/** Next, then the archetype's tile, a name, the page and Begin: the life from sixteen on that preset. */
export async function startArchetype(page: Page, archetype: string, timeout = 30_000): Promise<void> {
  await skipWalkthrough(page);
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  await page.getByRole("button", { name: archetype, exact: true }).click({ timeout });
  await nameAndBegin(page, timeout);
}
