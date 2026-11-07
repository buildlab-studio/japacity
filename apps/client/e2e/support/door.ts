// The way through the front door for a browser test (prologue:front-door-three-screens, prologue:front-door-builds-a-person, prologue:printed-page-hands-over): three
// screens with everything chosen but the name, whose box starts empty: the dice gives one. A tile: the dice, Next, the tile,
// Next to Where you live, Begin; its page fills and waits for Go (prologue:printed-page-hands-over). A ready life: the test asks
// for the ready lives as Settings does and opens the door again, on them, Back to the name for the dice, Next, then Pick on
// its kind, Begin.
import type { Page } from "@playwright/test";

/**
 * The first chapter's title stands over the world for a moment with nothing to press (chapter:first-chapter-mission-card); a later
 * chapter's card has Go, which takes the step and may open the map with the stop picked. A test that wants the world
 * as it stands waits the title out, or passes the card and closes that map. Where neither comes, the waits are short.
 */
export async function passOpeningWords(page: Page, timeout = 4_000): Promise<void> {
  const title = page.locator("[data-opening-title]");
  if (await title.isVisible().catch(() => false)) await title.waitFor({ state: "detached", timeout }).catch(() => undefined);
  await cardsSettled(page);
  const go = page.locator("[data-opening-go]");
  await go.waitFor({ state: "visible", timeout: 1_500 }).catch(() => undefined);
  if (!(await go.isVisible().catch(() => false))) return;
  await go.click();
  // A later chapter's Go opens the map in the same tick; the first brief's Let's go opens none, so the look is short.
  const close = page.locator("[data-map-close]");
  await close.waitFor({ state: "visible", timeout: Math.min(timeout, 2_000) }).catch(() => undefined);
  if (await close.isVisible()) await close.click();
}

/**
 * The first brief's card waits for the place's first frame (chapter:first-chapter-mission-card) and the city marks the
 * wait with `[data-brief-pending]` from the moment the band stands: a card is looked for only once that mark is gone, so
 * a card still coming never stands over the next tap. Where no world comes the waits end on their own.
 */
export async function cardsSettled(page: Page): Promise<void> {
  await page.locator("[data-band]").first().waitFor({ state: "attached", timeout: 20_000 }).catch(() => undefined);
  await page.waitForFunction(() => document.querySelector("[data-brief-pending]") === null, null, { timeout: 60_000 }).catch(() => undefined);
}

/** The name on the door's first screen: the dice rolled where the box is empty, since Begin never takes the placeholder. */
export async function giveName(page: Page, timeout = 30_000): Promise<void> {
  const box = page.locator("#door-name");
  await box.waitFor({ state: "visible", timeout });
  if ((await box.inputValue()) === "") await page.locator("[data-door-dice]").click({ timeout });
}

/** Begin on Where you live (still marked as the page it stood in for), until the door has gone. */
async function begin(page: Page, timeout: number): Promise<void> {
  await page.getByRole("button", { name: /^Begin/ }).click({ timeout });
  // The door's own page goes once Begin is pressed; the page after Begin wears the same header, so the gate is the mark.
  await page.locator("[data-gate='page'], [data-gate='begun']").first().waitFor({ state: "detached", timeout });
}

/** Asks for the ready lives as Settings' "Start from a ready life" does, which opens on them, then Pick on the kind named (else the first), Begin; then past the opening. */
export async function startReadyLife(page: Page, kind?: string, timeout = 30_000): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout });
  await page.evaluate(() => localStorage.setItem("japacity.door.ready", "1"));
  await page.reload();
  // The run opens on the ready lives with the box empty: Back to it for the dice, then Next to the lives again.
  await page.locator("[data-gate='ready']").waitFor({ timeout });
  await page.locator("[data-door-back]").click({ timeout });
  await giveName(page, timeout);
  await page.locator("[data-gate='you']").getByRole("button", { name: /^Next/ }).click({ timeout });
  const pick = kind === undefined ? page.getByRole("button", { name: /^Pick: / }).first() : page.getByRole("button", { name: `Pick: ${kind}` });
  await pick.click({ timeout });
  await begin(page, timeout);
  await passOpeningWords(page);
}

/** The page as the handover waits for the player (prologue:printed-page-hands-over): Go on it, once its years are in, if it shows. */
export async function passThePage(page: Page, timeout = 30_000): Promise<void> {
  const go = page.locator("[data-page-handover]").getByRole("button", { name: "Go", exact: true });
  // A life whose page is not shown (online, the server closes the years) goes straight to the world.
  await go.or(page.locator("[data-thumb='phone']")).first().waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (await go.isVisible().catch(() => false)) await go.click();
}

/**
 * The dice for a name, Next, the archetype's tile, Next to Where you live, Begin: the life from sixteen on that preset. Its
 * page fills and is passed with Go, unless `stay` leaves it on screen. A run kept past the first screen goes on from there.
 */
export async function startArchetype(page: Page, archetype: string, timeout = 30_000, stay = false): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().waitFor({ timeout });
  if (await page.locator("[data-gate='you']").isVisible()) await giveName(page, timeout);
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  await page.getByRole("radio", { name: archetype, exact: true }).click({ timeout });
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click({ timeout });
  await begin(page, timeout);
  if (!stay) await passThePage(page, timeout);
}
