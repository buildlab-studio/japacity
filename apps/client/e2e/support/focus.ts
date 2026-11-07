// The first field's focus as a screen opens (account:username-typed-and-checked, account:code-form-forgives,
// prologue:front-door-builds-a-person): on a desktop's fine pointer the field holds it; on a touch phone no field does, so
// no keyboard rises over the screen by itself.
import { expect, type Locator, type Page } from "@playwright/test";

import { FINE_POINTER } from "../../src/shared/ui/firstField";

/** Whether the page answers as a desktop: a fine pointer that hovers. */
export async function onDesktop(page: Page): Promise<boolean> {
  return await page.evaluate((query) => matchMedia(query).matches, FINE_POINTER);
}

/** No field to type in holds the focus, so no keyboard is up. */
export async function noFieldFocused(page: Page): Promise<void> {
  const typing = await page.evaluate(() => {
    const at = document.activeElement;
    return at instanceof HTMLInputElement || at instanceof HTMLTextAreaElement || (at instanceof HTMLElement && at.isContentEditable);
  });
  expect(typing, "a field holds the focus as the screen opens").toBe(false);
}

/** The field takes the focus as its screen opens on a desktop; on a touch phone it shows with no field holding the focus. */
export async function opensWithFocus(page: Page, field: Locator, options: { timeout?: number } = {}): Promise<void> {
  if (await onDesktop(page)) {
    await expect(field).toBeFocused(options);
    return;
  }
  await expect(field).toBeVisible(options);
  // The screen's own effects run as it mounts; a moment more lets a late focus show if there were one.
  await page.waitForTimeout(300);
  await expect(field).not.toBeFocused();
  await noFieldFocused(page);
}
