import { expect, test, type Page } from "@playwright/test";

import { E2E_SECRET } from "./playwright.config";

const COOKIE = "__Host-japacity-gate";
const YEAR_SECONDS = 31_536_000;

async function expectScreen(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Japacity" })).toBeVisible();
  await expect(page.getByText("The game opens soon.")).toBeVisible();
  await expect(page.getByRole("link", { name: "@japacityapp on X" })).toHaveAttribute("href", "https://x.com/japacityapp");
  await expect(page.getByRole("heading", { name: "The game" })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("a phone with no invite sees one screen: the game opens soon, with the X link, and no cookie", async ({ page, context }) => {
  await page.goto("/");
  await expectScreen(page);
  await page.goto("/play?card=granted");
  await expectScreen(page);
  expect(await context.cookies()).toEqual([]);
});

test("a wrong code shows the same screen and leaves no cookie", async ({ page, context }) => {
  await page.goto("/?code=not-the-code");
  await expectScreen(page);
  expect(await context.cookies()).toEqual([]);
});

test("the invite link lets the phone in, drops the code from the address, and the cookie keeps it in for a year", async ({ page, context }) => {
  await page.goto(`/?code=${E2E_SECRET}`);
  await expect(page.getByRole("heading", { name: "The game" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(page.url()).not.toContain(E2E_SECRET);

  const cookies = await context.cookies();
  expect(cookies).toHaveLength(1);
  const [gate] = cookies;
  expect(gate?.name).toBe(COOKIE);
  expect(gate?.httpOnly).toBe(true);
  expect(gate?.secure).toBe(true);
  expect(gate?.sameSite).toBe("Lax");
  expect(gate?.value).not.toContain(E2E_SECRET);
  const yearFromNow = Date.now() / 1000 + YEAR_SECONDS;
  expect(Math.abs((gate?.expires ?? 0) - yearFromNow)).toBeLessThan(120);
  expect(await page.evaluate(() => document.cookie)).not.toContain(COOKIE);

  // Later, from a plain address with no code.
  await page.goto("/somewhere");
  await expect(page.getByRole("heading", { name: "The game" })).toBeVisible();
  await expect(page.getByText("/somewhere")).toBeVisible();
});

test("an invite link to a deeper page keeps everything but the code", async ({ page }) => {
  await page.goto(`/?card=granted&code=${E2E_SECRET}`);
  await expect(page.getByRole("heading", { name: "The game" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("?card=granted");
});
