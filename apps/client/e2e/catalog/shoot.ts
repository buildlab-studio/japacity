// How a picture is taken and named. Every screen has its place in SCREENS (screens.ts), and its number is that place,
// so the pictures sort in the catalog's order whichever test took them and in whatever order the tests ran.
import { appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Locator, Page } from "@playwright/test";

import { SCREENS } from "./screens";
import { catalogDir, MISSED_FILE } from "./where";

const DIR = catalogDir();
/** Where the screen stood when a step failed: Playwright's output folder, never the catalog. */
const FAILED_DIR = join(tmpdir(), "japacity-catalog-output", "failed");

/** The file name a screen's picture takes: its place in the catalog, three figures, then its name. */
export function fileOf(key: string, part = 1): string {
  const at = SCREENS.findIndex((screen) => screen.key === key);
  if (at < 0) throw new Error(`No screen named ${key} in screens.ts.`);
  return `${String(at + 1).padStart(3, "0")}-${key}${part > 1 ? `-p${String(part)}` : ""}.png`;
}

/** Every motion of the interface is under half a second (R-WORLD-023); a picture waits that out, and the fonts. */
async function settle(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The screen as the player sees it now. */
export async function shot(page: Page, key: string, wait = 600): Promise<void> {
  await settle(page, wait);
  await page.screenshot({ path: join(DIR, fileOf(key)), fullPage: false, animations: "allow" });
}

/**
 * A screen that scrolls: its top, then a picture for each screenful further down, at most `most` in all, so words cut
 * low on a long screen are seen too. `within` is the screen's box; the part of it that scrolls is found inside it. The
 * scroller is put back at its top after.
 */
export async function shotPages(page: Page, key: string, within: Locator, most = 4, wait = 600): Promise<void> {
  await shot(page, key, wait);
  // The box itself, or the first thing inside it that scrolls, is marked so the steps below find it again.
  const box = await within
    .first()
    .evaluate((element) => {
      const scrolls = (node: Element) => node.scrollHeight > node.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(node).overflowY);
      const found = scrolls(element) ? element : [...element.querySelectorAll("*")].find(scrolls);
      if (found === undefined) return null;
      found.setAttribute("data-catalog-scroll", "");
      return { height: found.scrollHeight, view: found.clientHeight };
    })
    .catch(() => null);
  if (box === null || box.view <= 0) return;
  const scroller = page.locator("[data-catalog-scroll]").first();
  // Each page down overlaps the last by a little, so a line on the fold shows whole on one of them.
  const stride = Math.max(1, box.view - 48);
  for (let part = 2, top = stride; part <= most && top < box.height - box.view + stride; part += 1, top += stride) {
    await scroller.evaluate((element, to) => element.scrollTo({ top: to, behavior: "instant" }), top);
    await settle(page, 300);
    await page.screenshot({ path: join(DIR, fileOf(key, part)), fullPage: false });
  }
  await scroller.evaluate((element) => {
    element.scrollTo({ top: 0, behavior: "instant" });
    element.removeAttribute("data-catalog-scroll");
  });
}

/** A screen the shoot could not reach, and why: the contact sheet shows it in its place with the reason. */
export function missed(key: string, why: string): void {
  fileOf(key);
  appendFileSync(join(DIR, MISSED_FILE), `${JSON.stringify({ key, why })}\n`);
  console.log(`not reached: ${key}: ${why}`);
}

/**
 * Runs one screen's steps; a failure is written down as not reached and the test goes on to the next screen. The screen
 * as it stood when the step failed is kept with Playwright's own output, outside the catalog, for whoever mends the step.
 */
export async function attempt(page: Page, key: string, steps: () => Promise<void>): Promise<boolean> {
  try {
    await steps();
    return true;
  } catch (error) {
    missed(key, (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "failed");
    await page.screenshot({ path: join(FAILED_DIR, `${key}.png`) }).catch(() => undefined);
    return false;
  }
}
