// The pictures some specs save for a report when PREVIEW_DIR is set.
import { join } from "node:path";

import type { Page } from "@playwright/test";

const PREVIEW = process.env.PREVIEW_DIR;

/** The screen as `<name>-phone.png` or `<name>-desktop.png`, by the project's size. */
export async function shootAtSize(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await page.screenshot({ path: join(PREVIEW, `${name}-${size}.png`), fullPage: false });
}

/** The screen as `<name>.png`, on the phone project only, once it has settled. */
export async function shootPhone(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "" || !project.startsWith("Pixel")) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PREVIEW, `${name}.png`), fullPage: false });
}
