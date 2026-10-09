// The way through the front door for a browser test (prologue.md R-PROLOGUE-009): past the look and the
// name with Next, then a ready life by its kind (the first one when none is named), or an archetype's tile.
import type { Page } from "@playwright/test";

/** Next, "Start from a ready life", then Begin on the kind named, else the first ready life. */
export async function startReadyLife(page: Page, kind?: string, timeout = 30_000): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  await page.getByRole("button", { name: /^Start from a ready life/ }).first().click({ timeout });
  const begin = kind === undefined ? page.getByRole("button", { name: /^Begin: / }).first() : page.getByRole("button", { name: `Begin: ${kind}` });
  await begin.click({ timeout });
}

/** Next, then the archetype's tile: the life from sixteen on that preset. */
export async function startArchetype(page: Page, archetype: string, timeout = 30_000): Promise<void> {
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout });
  await page.getByRole("button", { name: archetype, exact: true }).click({ timeout });
}
