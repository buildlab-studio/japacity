// The pictures some specs save for a report when PREVIEW_DIR is set.
import { join } from "node:path";

import type { Page } from "@playwright/test";

const PREVIEW = process.env.PREVIEW_DIR;

/** The folder the pictures go to, or null when none are asked for. */
export const previewDir = PREVIEW === undefined || PREVIEW === "" ? null : PREVIEW;

/** The screen as `<file>.png`, when pictures are asked for; `settleMs` waits first, `fullPage` takes the whole page. */
export async function shoot(page: Page, file: string, { fullPage = false, settleMs = 0 }: { fullPage?: boolean; settleMs?: number } = {}): Promise<void> {
  if (previewDir === null) return;
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  await page.screenshot({ path: join(previewDir, `${file}.png`), fullPage });
}

/** The screen as `<name>-phone.png` or `<name>-desktop.png`, by the project's size. */
export async function shootAtSize(page: Page, name: string, project: string, fullPage = false): Promise<void> {
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await shoot(page, `${name}-${size}`, { fullPage });
}

/** The screen as `<name>.png`, on the phone project only, once it has settled; at `viewport` when one is given. */
export async function shootPhone(page: Page, name: string, project: string, viewport?: { width: number; height: number }): Promise<void> {
  if (previewDir === null || !project.startsWith("Pixel")) return;
  if (viewport !== undefined) await page.setViewportSize(viewport);
  await shoot(page, name, { settleMs: 300 });
}
