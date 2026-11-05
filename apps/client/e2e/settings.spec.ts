// Settings' segmented choices in a real browser (world:reach-and-read): at 375 by 667, 390 by 844 and 360 by 780, by day and by
// night, every label of the sound's and the graphics' pills sits whole inside its control, with the same inner space at its
// edges as its neighbours have. With PREVIEW_DIR set, Settings is shot at each size by day and by night.
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";
import { SOFTWARE_WEBGL } from "./support/browser";
import { startReadyLife } from "./support/door";
import { openApp, passCards } from "./support/live";
import { shootAtSize } from "./support/preview";

test.use({ launchOptions: SOFTWARE_WEBGL });

/** An iPhone SE, a common phone and a small Android. */
const SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
] as const;
const PAINTS = ["day", "night"] as const;

/** One choice of a segmented pill as drawn: its box, its words' box, and the group's box. */
interface Drawn {
  group: string;
  label: string;
  box: { left: number; right: number; top: number; bottom: number };
  words: { left: number; right: number; top: number; bottom: number };
  within: { left: number; right: number };
  /** The control's own inner space at each side, its padding. */
  padding: { left: number; right: number };
}

/** Every choice of Settings' segmented pills, measured as drawn. */
function choicesDrawn(page: Page): Promise<Drawn[]> {
  return page.evaluate(() => {
    const plain = (rect: DOMRect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    const drawn: Drawn[] = [];
    for (const group of document.querySelectorAll('[data-phone-app="settings"] [data-settings-card] [role="radiogroup"]')) {
      for (const choice of group.querySelectorAll('[role="radio"]')) {
        const range = document.createRange();
        range.selectNodeContents(choice);
        drawn.push({
          group: group.getAttribute("aria-label") ?? "",
          label: (choice.textContent ?? "").trim(),
          box: plain(choice.getBoundingClientRect()),
          words: plain(range.getBoundingClientRect()),
          within: plain(group.getBoundingClientRect()),
          padding: { left: parseFloat(getComputedStyle(choice).paddingLeft), right: parseFloat(getComputedStyle(choice).paddingRight) },
        });
      }
    }
    return drawn;
  });
}

/**
 * What breaks world:reach-and-read in the drawn choices: a label eating into its control's inner space at either side, a label
 * past its control's top or foot, a control past its pill, or a control whose inner space differs from a neighbour's.
 */
function faults(drawn: Drawn[], at: string): string[] {
  const found: string[] = [];
  const near = 1;
  for (const choice of drawn) {
    const left = choice.words.left - choice.box.left;
    const right = choice.box.right - choice.words.right;
    if (left + near < choice.padding.left || right + near < choice.padding.right) {
      found.push(`${at}: ${choice.group} "${choice.label}" leaves ${left.toFixed(1)} px on the left and ${right.toFixed(1)} px on the right of ${String(choice.padding.left)} and ${String(choice.padding.right)}`);
    }
    if (choice.words.top < choice.box.top || choice.words.bottom > choice.box.bottom) found.push(`${at}: ${choice.group} "${choice.label}" runs past its control's top or foot`);
    if (choice.box.left < choice.within.left - near || choice.box.right > choice.within.right + near) found.push(`${at}: ${choice.group} "${choice.label}" runs past its pill`);
  }
  const paddings = drawn.map((choice) => `${String(choice.padding.left)} ${String(choice.padding.right)}`);
  if (new Set(paddings).size > 1) found.push(`${at}: the choices have unlike inner space: ${paddings.join(", ")} px`);
  return found;
}

test("[world:reach-and-read] given Settings open, when it is drawn at 375 by 667, 390 by 844 and 360 by 780, by day and by night, then every label of its segmented choices sits whole inside its control with the inner space its neighbours have", async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.setViewportSize(SIZES[1]);
  await page.goto("/");
  await startReadyLife(page);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  await passCards(page);
  await openApp(page, "settings");
  const found: string[] = [];
  for (const size of SIZES) {
    await page.setViewportSize(size);
    for (const paint of PAINTS) {
      await page.evaluate((to) => {
        document.documentElement.dataset.paint = to;
      }, paint);
      await page.waitForTimeout(400);
      const drawn = await choicesDrawn(page);
      expect(drawn.length, "the sound's two choices and the graphics' three").toBe(5);
      found.push(...faults(drawn, `${String(size.width)} by ${String(size.height)} by ${paint}`));
      await shootAtSize(page, `settings-${String(size.width)}-${paint}`, info.project.name);
    }
  }
  expect(found).toEqual([]);
});
