import type { Command, Id } from "@japacity/sim";
import type { PresetRequest } from "@japacity/api";
import { worldClockAt } from "@japacity/sim";
import { start, type Game } from "@japacity/sim/testing";

import { expect, type Page, type Route } from "@playwright/test";
import { test } from "./support/policy";

// The life's screens are one part fetched apart from the start screen (engine:first-download-has-budget), failing softly
// (world:lazy-part-fails-softly): the start screen draws without them, a new visitor's Play goes through the door to the world with
// their first fetch failed and the next held back, a returning player reaches the world on the opening splash, and a tab on an older
// build reloads once to the newer one. Played against a faked server that runs the simulation itself, as newlife.spec.ts does.
import { content } from "../../../packages/content/src/index";
import { playPresetOn } from "../src/shared/net/preset.testing";
import { accountView } from "../src/shared/testing/fixtures";
import { clockAt, fakeTurnstile, json, NO_CHARACTER, NOT_FAKED, ONLINE, quietSocket, SIGNED_OUT, STANDING, viewReply } from "./support/api";
import { SOFTWARE_WEBGL } from "./support/browser";
import { giveName, passOpeningWords, passThePage } from "./support/door";
import { placeReady } from "./support/live";

test.use({ baseURL: ONLINE, launchOptions: SOFTWARE_WEBGL });

/** The life's screens' own part, by its path under the dev server and its chunk's name in a build. */
const LIFE_PART = /\/src\/app\/Life\.tsx|\/assets\/Life-[\w-]+\.js/;

/** The opening splash, which stands while the life's screens come (the mission card over the world has its own opening mark). */
const SPLASH = "[data-splash][data-opening]";

/** Every /api route a new visitor or a returning player calls, answered from the one life the faked account holds. */
async function fakeServer(page: Page, { alive }: { alive: boolean }): Promise<{ sent: string[] }> {
  let game: Game | null = alive ? start({ scenario: "scenario.banker", content }) : null;
  let account = alive;
  const sent: string[] = [];
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const asked = `${request.method()} ${new URL(request.url()).pathname}`;
      sent.push(asked);
      if (asked === "GET /api/view") {
        if (!account) return route.fulfill(json(SIGNED_OUT.body, 401));
        return route.fulfill(game === null ? json(NO_CHARACTER, 404) : json(viewReply(game, clockAt(3).tick)));
      }
      if (asked === "GET /api/age") return route.fulfill(json({ refused: false }));
      if (asked === "POST /api/age") return route.fulfill(json({ ok: true }));
      if (asked === "GET /api/username/available") return route.fulfill(json({ ok: true, free: true }));
      if (asked === "POST /api/guest") {
        account = true;
        return route.fulfill(json({ ok: true, account: accountView({ id: "account-guest", state: "guest", username: "ada_lagos", character: null }) }));
      }
      if (asked === "POST /api/character") {
        const { scenario } = request.postDataJSON() as { scenario: Id<"scenario"> };
        game = start({ scenario, content });
        return route.fulfill(json(viewReply(game)));
      }
      if (asked === "POST /api/prologue/preset" && game !== null) {
        return route.fulfill(json(playPresetOn(game, request.postDataJSON() as PresetRequest, { ...clockAt(game.tick), morningAt: 0, world: worldClockAt(game.tick) })));
      }
      if (asked === "POST /api/command" && game !== null) {
        const { command } = request.postDataJSON() as { command: Command };
        const result = game.send(command);
        if (!result.ok) return route.fulfill(json({ ok: false, code: result.code, detail: result.detail }, 409));
        return route.fulfill(json({ ...viewReply(game), lines: result.lines }));
      }
      if (asked === "GET /api/account") {
        if (!account) return route.fulfill(json(SIGNED_OUT.body, 401));
        return route.fulfill(json({ ok: true, account: accountView({ id: "account-guest", state: "guest", username: "ada_lagos", character: game === null ? null : "c-1" }) }));
      }
      if (asked === "GET /api/moderation/standing") return route.fulfill(json(STANDING));
      return route.fulfill(json(NOT_FAKED, 404));
    },
  );
  await quietSocket(page);
  await fakeTurnstile(page, { drawn: true });
  return { sent };
}

/** The life's part held: each fetch waits until let go; `fail` of them first fail as a dropped connection does. */
async function holdLifePart(page: Page, fail: number): Promise<{ go: () => void; asked: () => number }> {
  let asked = 0;
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  await page.route(LIFE_PART, async (route: Route) => {
    asked += 1;
    if (asked <= fail) return route.abort("internetdisconnected");
    await opened;
    return route.fallback();
  });
  return { go: open, asked: () => asked };
}

test.describe("the life's screens, a part apart from the start screen (world:lazy-part-fails-softly)", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "The part's fetch is failed and held through Chromium's network");
    // The door, the years of the page and the world's first load, held on a part and on a loaded machine.
    test.setTimeout(180_000);
  });

  test("[engine:first-download-has-budget] [world:lazy-part-fails-softly] [account:start-screen-over-live-city] given the life's screens fail on their first fetch and are held on the next, then the start screen draws with Play, and Play goes through the age screen and the door to the world once they come", async ({ page }) => {
    await fakeServer(page, { alive: false });
    const part = await holdLifePart(page, 1);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 30_000 });
    // The start screen is drawn without the life's screens: fetched ahead on the idle page, the first fetch fails and the next waits.
    await expect.poll(part.asked, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.locator("[data-trouble]")).toHaveCount(0);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("combobox", { name: "Day" }).selectOption("17");
    await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "May" });
    await page.getByRole("combobox", { name: "Year" }).selectOption("1990");
    await page.getByRole("button", { name: "Continue" }).click();
    await giveName(page, 20_000);
    await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 20_000 });
    await page.getByRole("radio", { name: "The developer", exact: true }).click();
    await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
    await page.getByLabel("Username").fill("ada_lagos");
    await expect(page.getByText("That name is free.")).toBeVisible();
    part.go();
    await page.getByRole("button", { name: /^Begin/ }).click();
    await passThePage(page);
    await expect(page.locator('[data-thumb="phone"]')).toBeVisible({ timeout: 60_000 });
    await passOpeningWords(page, 20_000);
    await expect(page.locator("[data-band]")).toBeVisible();
    await expect(page.locator("[data-broken]")).toHaveCount(0);
  });

  test("[world:lazy-part-fails-softly] given a returning player with a life kept in this browser whose screens fail once and then come slowly, when the page opens, then the opening splash stands with no card and the world opens on it", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("japacity.walkthrough", "1");
      localStorage.setItem("japacity.person", JSON.stringify({ look: "person_ada", name: "Ada", archetype: null }));
    });
    await fakeServer(page, { alive: true });
    const part = await holdLifePart(page, 1);
    await page.goto("/");
    await expect(page.locator(SPLASH).locator("[data-waiting]")).toBeVisible({ timeout: 30_000 });
    await expect.poll(part.asked, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator(SPLASH)).toBeVisible();
    await expect(page.locator("[data-trouble]")).toHaveCount(0);
    part.go();
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await placeReady(page);
    await expect(page.locator(SPLASH)).toHaveCount(0);
    await expect(page.locator("[data-broken]")).toHaveCount(0);
  });

  test("[world:lazy-part-fails-softly] given a returning player whose character only the account knows, with no person and no mark kept, when the world opens, then the browser keeps the mark of a life, so the next load asks for the life's screens at once", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
    await fakeServer(page, { alive: true });
    await page.goto("/");
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await placeReady(page);
    expect(await page.evaluate(() => [localStorage.getItem("japacity.person"), localStorage.getItem("japacity.life.here")])).toEqual([null, "1"]);
  });

  test("[world:lazy-part-fails-softly] given a tab on an older build whose life's screens are gone, when they fail after their fetches again, then the page reloads once to the server's newer build, and when they fail there too the connection card shows with Retry, never a second reload", async ({ page }) => {
    await fakeServer(page, { alive: true });
    await page.route(LIFE_PART, (route) => route.abort("internetdisconnected"));
    // The page the server serves now, as a script reads it: a newer build's stamp.
    await page.route(
      (url) => url.pathname === "/",
      async (route) => {
        if (route.request().resourceType() === "document") return route.fallback();
        const served = await route.fetch();
        const body = (await served.text()).replace(/(<meta name="japacity-build" content=")[^"]*"/, '$1a-newer-build"');
        return route.fulfill({ response: served, body });
      },
    );
    let loads = 0;
    page.on("load", () => {
      loads += 1;
    });
    await page.goto("/");
    const card = page.locator('[data-trouble="network"][data-trouble-during="part"]');
    await expect(card).toBeVisible({ timeout: 60_000 });
    expect(loads).toBe(2);
    await expect(card.getByRole("button", { name: "Retry" })).toBeVisible();
    await page.waitForTimeout(2_000);
    expect(loads).toBe(2);
    await expect(page.locator("[data-broken]")).toHaveCount(0);
  });
});
