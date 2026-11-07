// The front door on a desk in a real browser (prologue:front-door-three-screens, prologue:printed-page-hands-over,
// prologue:front-door-builds-a-person): at 1440 by 900 and 1280 by 800 nothing in the door scrolls the page, every look and every
// life stands in view at once, and the yellow action keeps one place from step to step; at 1024 by 700 it still fits, the
// panel scrolling inside itself; the page on the stage fills in as the run goes; and the keys work, never taking what is
// typed in the name box. The desk is a desktop's, so these run on the Desktop Chrome project alone.
import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

const SIZES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 700 },
];

const DESK_ONLY = "The desk is a desktop's layout.";

/** True when the page itself does not scroll: the document is no taller or wider than the window. */
async function pageStill(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollHeight <= window.innerHeight && root.scrollWidth <= window.innerWidth && window.scrollY === 0;
  });
}

async function actionBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator("[data-door-foot] [data-door-action]").boundingBox();
  if (box === null) throw new Error("No action.");
  return box;
}

for (const size of SIZES) {
  const roomy = size.width >= 1280;
  test(`[prologue:front-door-three-screens] given a desk at ${String(size.width)} by ${String(size.height)}, when the run goes through its three steps, then the page never scrolls, the yellow action keeps one place${roomy ? ", and every look and every life stands in view at once" : ", and the panel holds every look and every life"}`, async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("Desktop"), DESK_ONLY);
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator("[data-door-desk][data-gate='you']")).toBeVisible({ timeout: 30_000 });
    await page.locator("[data-door-dice]").click();
    expect(await pageStill(page)).toBe(true);
    const first = await actionBox(page);
    const looks = page.locator("[data-looks] [role='radio']");
    expect(await looks.count()).toBeGreaterThan(8);
    if (roomy) for (const look of await looks.all()) await expect(look).toBeInViewport({ ratio: 1 });

    await page.locator("[data-door-foot] [data-door-action]").click();
    await expect(page.locator("[data-door-desk][data-gate='life']")).toBeVisible();
    expect(await pageStill(page)).toBe(true);
    expect(await actionBox(page)).toEqual(first);
    const lives = page.locator("[data-archetypes] [role='radio']");
    expect(await lives.count()).toBe(7);
    if (roomy) {
      for (const life of await lives.all()) await expect(life).toBeInViewport({ ratio: 1 });
      await expect(page.locator("[data-door-age]")).toBeInViewport({ ratio: 1 });
    }

    await page.locator("[data-door-foot] [data-door-action]").click();
    await expect(page.locator("[data-door-desk][data-gate='page']")).toBeVisible();
    expect(await pageStill(page)).toBe(true);
    expect(await actionBox(page)).toEqual(first);
    // The page beside the figure stands clear of the panel and its action.
    const side = await page.locator("[data-desk-page]").boundingBox();
    const panel = await page.locator("[data-door-panel]").boundingBox();
    expect(side !== null && panel !== null && side.x + side.width <= panel.x).toBe(true);
  });
}

test("[prologue:front-door-builds-a-person] [prologue:printed-page-hands-over] given a desk, then the name box holds the focus with the page's name row as its dots; a name typed prints on the page as it is typed, and the age and the path come with the lives", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Desktop"), DESK_ONLY);
  await page.goto("/");
  const box = page.locator("#door-name");
  await expect(box).toBeFocused({ timeout: 30_000 });
  await expect(box).toHaveValue("");
  const name = page.locator("[data-desk-page] [data-field='name']");
  await expect(name).toContainText("· · ·");
  await box.pressSequentially("Ada");
  await expect(name).toContainText("Ada");
  await expect(page.locator("[data-desk-page] [data-field='path']")).toContainText("· · ·");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-gate='life']")).toBeVisible();
  await expect(page.locator("[data-desk-page] [data-field='age']")).toContainText(/\d+ yrs/);
  await expect(page.locator("[data-desk-page] [data-field='path']")).not.toContainText("· · ·");
});

test("[prologue:front-door-three-screens] given a desk, then the arrows move the look and the life, R rolls the name and Enter is the yellow action; typed into the name box, the same keys are letters and moves of the caret, never the door's", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("Desktop"), DESK_ONLY);
  await page.goto("/");
  const box = page.locator("#door-name");
  await expect(box).toBeFocused({ timeout: 30_000 });
  const picked = (group: string) => page.locator(`[${group}] [role='radio'][aria-checked='true']`);
  const firstLook = await picked("data-looks").getAttribute("data-look");
  // In the box: R and the arrows are typing.
  await page.keyboard.type("Rr");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(box).toHaveValue("Rr");
  await expect(picked("data-looks")).toHaveAttribute("data-look", firstLook ?? "");
  await box.fill("");
  // Out of the box: the door's keys.
  await page.locator("[data-door-stage]").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("ArrowRight");
  await expect(picked("data-looks")).not.toHaveAttribute("data-look", firstLook ?? "");
  await page.keyboard.press("ArrowLeft");
  await expect(picked("data-looks")).toHaveAttribute("data-look", firstLook ?? "");
  await page.keyboard.press("r");
  await expect(box).not.toHaveValue("");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-gate='life']")).toBeVisible();
  const firstLife = await picked("data-archetypes").getAttribute("data-archetype");
  await page.keyboard.press("ArrowDown");
  await expect(picked("data-archetypes")).not.toHaveAttribute("data-archetype", firstLife ?? "");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-gate='page']")).toBeVisible();
});
