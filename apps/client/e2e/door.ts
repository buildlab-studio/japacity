// The way through the front door for a browser test (prologue.md R-PROLOGUE-013, 014): three screens with everything
// chosen. A tile: Next, the tile, Print my page, Begin; its page fills and waits for Go (R-PROLOGUE-014). A ready life: the
// test asks for the ready lives as Settings does and opens the door again, then Next, Pick on its kind, Begin.
import type { Page } from "@playwright/test";

/**
 * The first chapter's title stands over the world for a moment with nothing to press (R-CHAPTER-011); a later
 * chapter's card has Go, which takes the step and may open the map with the stop picked. A test that wants the world
 * as it stands waits the title out, or passes the card and closes that map. The classic page has neither, so the wait is short.
 */
export async function passOpeningWords(page: Page, timeout = 4_000): Promise<void> {
  const title = page.locator("[data-opening-title]");
  if (await title.isVisible().catch(() => false)) await title.waitFor({ state: "detached", timeout }).catch(() => undefined);
  const go = page.locator("[data-opening-go]");
  if (!(await go.isVisible().catch(() => false))) return;
  await go.click();
  const close = page.locator("[data-map-close]");
  await close.waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (await close.isVisible()) await close.click();
}

/** Begin on the page, until the door has gone. */
async function begin(page: Page, timeout: number): Promise<void> {
  await page.getByRole("button", { name: /^Begin/ }).click({ timeout });
  await page.locator("[data-door-progress]").waitFor({ state: "detached", timeout });
}

/** Asks for the ready lives as Settings' "Start from a ready life" does, then Next, Pick on the kind named (else the first), Begin; then past the opening. */
export async function startReadyLife(page: Page, kind?: string, timeout = 30_000): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout });
  await page.evaluate(() => localStorage.setItem("japacity.door.ready", "1"));
  await page.reload();
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  const pick = kind === undefined ? page.getByRole("button", { name: /^Pick: / }).first() : page.getByRole("button", { name: `Pick: ${kind}` });
  await pick.click({ timeout });
  await begin(page, timeout);
  await passOpeningWords(page);
}

/** The page as the handover waits for the player (R-PROLOGUE-014): Go on it, once its years are in, if it shows. */
export async function passThePage(page: Page, timeout = 30_000): Promise<void> {
  const go = page.locator("[data-page-handover]").getByRole("button", { name: "Go", exact: true });
  await go.waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (await go.isVisible().catch(() => false)) await go.click();
}

/**
 * Next, the archetype's tile, Print my page, Begin: the life from sixteen on that preset. Its page fills and is passed
 * with Go, unless `stay` leaves it on screen.
 */
export async function startArchetype(page: Page, archetype: string, timeout = 30_000, stay = false): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  await page.getByRole("radio", { name: archetype, exact: true }).click({ timeout });
  await page.getByRole("button", { name: /^Print my page/ }).first().click({ timeout });
  await begin(page, timeout);
  if (!stay) await passThePage(page, timeout);
}
