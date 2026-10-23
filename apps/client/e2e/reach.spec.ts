// The guard for reach and read (world:reach-and-read) on a phone: the main screens a new player walks, from the start screen through the
// age screen and the door's steps, into the world, the phone and an app, and the map, each measured as it is drawn. A control a
// tap can reach with a hit area under 44 by 44 CSS pixels, or text under 12 CSS pixels, fails it, named. Played against a faked
// server, as online.spec.ts is.
import { start } from "@japacity/sim/testing";

import { expect, type Page, test } from "@playwright/test";

import { content } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { type Answer, clockAt, fakeServer, NO_CHARACTER, ONLINE, SIGNED_OUT, STANDING, viewReply } from "./support/api";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords } from "./support/door";
import { openApp, passCards, passHomeTeach, placeReady } from "./support/live";
import { reachOnScreen } from "./support/reach";

test.use({ baseURL: ONLINE, launchOptions: SOFTWARE_WEBGL });

const GUEST = accountView({ id: "account-guest", state: "guest" });

/** The screen as it stands, measured: every control under 44 px and every text under 12 px, by the screen's name. */
async function measured(page: Page, screen: string, found: string[]): Promise<void> {
  // Motions settle first: a sheet still rising is measured where it stops.
  await page.waitForTimeout(700);
  const reach = await reachOnScreen(page);
  for (const small of reach.targets) found.push(`${screen}: control ${small.where} is ${String(small.width)} by ${String(small.height)}`);
  for (const small of reach.texts) found.push(`${screen}: text ${small.where} is ${String(small.height)} px`);
}

test.describe("reach and read on a phone (world:reach-and-read)", () => {
  test.beforeEach(({ browserName }, info) => {
    test.skip(info.project.name !== "Pixel 7" || browserName !== "chromium", "Measured on the phone, in Chromium");
    test.setTimeout(240_000);
  });

  test("[world:reach-and-read] given a new visitor walking the start screen, the age screen and the door's steps, then every control has a 44 by 44 hit area and no text is under 12 px", async ({ page }) => {
    const answers: Record<string, Answer> = {
      "GET /api/view": SIGNED_OUT,
      "GET /api/age": { body: { refused: false } },
      "POST /api/age": { body: { ok: true } },
      "GET /api/username/available": { body: { ok: true, free: true } },
      "POST /api/guest": { body: { ok: true, account: GUEST } },
      "POST /api/character": { status: 404, body: NO_CHARACTER },
      "GET /api/account": { body: { ok: true, account: GUEST } },
    };
    await fakeServer(page, answers, { check: { drawn: true } });
    const found: string[] = [];
    await page.goto("/");
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeVisible({ timeout: 30_000 });
    await measured(page, "start", found);
    await play.click();
    await expect(page.getByRole("combobox", { name: "Day" })).toBeVisible({ timeout: 20_000 });
    await measured(page, "age", found);
    await page.getByRole("combobox", { name: "Day" }).selectOption("17");
    await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "May" });
    await page.getByRole("combobox", { name: "Year" }).selectOption("1990");
    await page.getByRole("button", { name: "Continue" }).click();
    const next = page.getByRole("button", { name: /^Next/ }).first();
    await expect(next).toBeVisible({ timeout: 20_000 });
    await measured(page, "door who", found);
    await next.click();
    const life = page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ });
    await expect(life).toBeVisible({ timeout: 20_000 });
    await measured(page, "door life", found);
    await life.click();
    const username = page.getByLabel("Username");
    await expect(username).toBeVisible({ timeout: 20_000 });
    await username.fill("ada_lagos");
    await page.waitForTimeout(800);
    await measured(page, "door page", found);
    await username.scrollIntoViewIfNeeded();
    await measured(page, "door page at the box", found);
    expect(found).toEqual([]);
  });

  test("[world:reach-and-read] given a life in the world, when the world, the phone, its Bank and the map are opened in turn, then every control has a 44 by 44 hit area and no text is under 12 px", async ({ page }) => {
    const game = start({ scenario: "scenario.banker", content });
    game.grant(1);
    game.endTurn([]);
    await fakeServer(page, {
      "GET /api/view": { body: viewReply(game, clockAt(3).tick) },
      "GET /api/account": { body: { ok: true, account: accountView() } },
      "GET /api/moderation/standing": { body: STANDING },
    });
    const found: string[] = [];
    await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
    await page.goto("/");
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await passOpeningWords(page);
    await placeReady(page);
    await passHomeTeach(page);
    await passCards(page);
    await measured(page, "world", found);

    await page.locator('[data-thumb="phone"]').click();
    await expect(page.locator("[data-phone]")).toBeVisible();
    await measured(page, "phone", found);
    await openApp(page, "bank");
    await measured(page, "bank", found);
    await page.locator("[data-home-bar]").click();
    await expect(page.locator("[data-phone]")).toHaveCount(0);

    await page.locator('[data-thumb="map"]').click();
    await expect(page.locator("[data-map]")).toBeVisible({ timeout: 30_000 });
    await measured(page, "map", found);
    expect(found).toEqual([]);
  });
});
