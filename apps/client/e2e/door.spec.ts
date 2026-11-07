// The front door in a real browser (prologue:front-door-three-screens): "Make it yours" kept in sight, since an expanded
// section can open below the fold. Opened, the section comes whole into the door's body once the figure is read and its
// rows stand; a colour picked brings the next part to choose whole into view the same way. Both sizes; and under
// reduced motion the same, at once.
import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./support/policy";

import { SOFTWARE_WEBGL } from "./support/browser";

// The rows follow what the figure reads of its look, so the figure must be drawn: WebGL in software, as the smoke spec has it.
test.use({ launchOptions: SOFTWARE_WEBGL });

/** True when the element stands whole inside the door's body, the part of the screen that scrolls between the head row and the foot. */
async function wholeInBody(page: Page, element: Locator): Promise<boolean> {
  const body = await page.locator("[data-door-body]").boundingBox();
  const box = await element.boundingBox();
  if (body === null || box === null) return false;
  return box.y >= body.y - 1 && box.y + box.height <= body.y + body.height + 1;
}

/**
 * Make it yours opened: on a phone with a tap; on a desk it stands open from the start (prologue:front-door-three-screens), so the
 * body is scrolled back to its top, where the name and the looks are, and the tap closes and opens it again.
 */
async function openYours(page: Page): Promise<void> {
  await page.goto("/");
  const open = page.locator("[data-yours-open]");
  await open.waitFor({ timeout: 30_000 });
  if (await page.locator("[data-door-desk]").isVisible()) {
    await expect(open).toHaveAttribute("aria-expanded", "true");
    await open.click();
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await page.locator("[data-door-body]").evaluate((body) => body.scrollTo({ top: 0, behavior: "instant" }));
  }
  await open.click();
  await page.locator("[data-yours-row='skin']").waitFor({ timeout: 30_000 });
}

for (const reduced of [false, true]) {
  test(`[prologue:front-door-three-screens] given the first screen${reduced ? " under reduced motion" : ""}, when Make it yours is opened, then its section stands whole in view, and each colour picked brings the next part whole into view`, async ({ page }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await openYours(page);
    const section = page.locator("[data-door-yours]");
    await expect.poll(() => wholeInBody(page, section), { timeout: 5_000 }).toBe(true);
    await expect(section).toBeInViewport({ ratio: 1 });

    // The rows the figure read, in turn: each pick brings the one after it into view.
    const rows = await page.locator("[data-yours-row]").evaluateAll((all) => all.map((row) => row.getAttribute("data-yours-row") ?? ""));
    expect(rows.slice(0, 2)).toContain("skin");
    for (const [at, part] of rows.entries()) {
      const next = rows[at + 1];
      if (next === undefined || part === "fabric") break;
      // Scrolled back so the next row is out of sight, as a player who scrolled up to see the figure would leave it.
      await page.locator("[data-door-body]").evaluate((body) => body.scrollTo({ top: 0, behavior: "instant" }));
      const choice = page.locator(`[data-yours-row='${part}'] [role='radio'][aria-checked='false']`).first();
      await choice.click();
      await expect.poll(() => wholeInBody(page, page.locator(`[data-yours-row='${next}']`)), { timeout: 5_000 }).toBe(true);
    }
  });
}

test("[prologue:front-door-builds-a-person] given the first screen on the narrowest phone, then the name's title, its one line of what the name is for and the box stand in that order, the line on one line", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  const hint = page.locator("[data-door-name-hint]");
  await expect(hint).toHaveText("What people in your story call you.", { timeout: 30_000 });
  await expect(page.locator("label[for='door-name']")).toHaveText("Character name");
  await expect(page.locator("#door-name")).toHaveValue("");
  await expect(page.locator("#door-name")).not.toHaveAttribute("placeholder", /^(Name)?$/);
  const lines = await hint.evaluate((line) => Math.round(line.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(line).lineHeight)));
  expect(lines).toBe(1);
  const [title, said, box] = await Promise.all(["label[for='door-name']", "[data-door-name-hint]", "#door-name"].map((at) => page.locator(at).boundingBox()));
  expect((title?.y ?? 0) < (said?.y ?? 0) && (said?.y ?? 0) < (box?.y ?? 0)).toBe(true);
});

test("[prologue:front-door-builds-a-person] given the first screen, then the empty box holds the focus with its ring in view and its suggestion in a lighter ink than a name; the dice fills it; Begin with it empty comes back to it focused, saying the story needs a name", async ({ page }) => {
  await page.goto("/");
  const box = page.locator("#door-name");
  await expect(box).toBeFocused({ timeout: 30_000 });
  await expect(box).toHaveValue("");
  const ring = await box.evaluate((input) => getComputedStyle(input).boxShadow);
  expect(ring).not.toBe("none");
  const [placeholder, typed] = await box.evaluate((input) => [getComputedStyle(input, "::placeholder").color, getComputedStyle(input).color]);
  expect(placeholder).not.toBe(typed);
  const suggestion = await box.getAttribute("placeholder");
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /^Begin/ }).click();
  await expect(page.locator("[data-gate='you']")).toBeVisible();
  await expect(box).toBeFocused();
  await expect(box).toHaveValue("");
  await expect(box).toBeInViewport();
  await expect(page.locator("[data-door-name-needed]")).toHaveText("Your story needs a name.");
  await page.locator("[data-door-dice]").click();
  await expect(box).not.toHaveValue("");
  await expect(page.locator("[data-door-name-needed]")).toHaveCount(0);
  expect(suggestion).not.toBe("");
});
