// The dedication in a real browser (docs/rules/world.md R-WORLD-036; account.md R-ACCOUNT-032 and R-ACCOUNT-033;
// moderation.md R-MODERATION-021; city.md R-CITY-021): in a life, the lantern canoe on the open map of Lagos opens the
// page and folds nothing; offline the water is out of reach. Online, against a server faked here with one store shared
// by every page, an account lights a light and sees its name, a second account sees one more bare light and no name,
// the admin approves it on the admin page, the second account then sees the name, and Put it out takes it away. Five
// taps on Settings' version line open the page offline. Phone only: the design is drawn for a phone.
import { start } from "@japacity/sim/testing";
import { join } from "node:path";

import { type Browser, devices, expect, test, type Page } from "@playwright/test";

import { content } from "../../../packages/content/src/index";
import { ADMIN_GETS } from "../src/features/admin/admin.testing";
import { passOpeningWords, startReadyLife } from "./door";
import { LIVED, openApp, passCards, passHomeTeach, placeReady } from "./live";

const PREVIEW = process.env.PREVIEW_DIR;
/** The second dev server, built with VITE_SERVER_URL pointing at itself, so every /api request is same-origin and faked here. */
const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
/** The pictures are taken at the design's 390 by 844, three device pixels to each. */
const SIZE = PREVIEW === undefined || PREVIEW === "" ? {} : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 };

test.use({ ...SIZE, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
test.skip(({ isMobile }) => !isMobile, "The dedication is drawn for a phone.");

/** What this spec reads of the map's probe (map.spec.ts declares the rest). */
interface CanoeProbe {
  ready: boolean;
  phase: string;
  stops: { id: string; at: [number, number] }[];
  canoe: [number, number] | null;
}

/** The map's probe as this spec reads it. */
const mapProbe = (page: Page) => page.evaluate(() => (window as unknown as { __map?: CanoeProbe }).__map ?? null);
const mapIs = (page: Page, phase: "ready" | "open") =>
  page.waitForFunction((want) => {
    const probe = (window as unknown as { __map?: CanoeProbe }).__map;
    return want === "ready" ? probe?.ready === true : probe?.phase === want;
  }, phase, { timeout: 30_000 });

/** The pictures for the report, at 390 by 844 as the design's, named as the design's so the pairs can be compared. */
async function shoot(page: Page, name: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  await page.screenshot({ path: join(PREVIEW, `${name}.png`), fullPage: false });
}

const dedicationPage = (page: Page) => page.getByRole("dialog", { name: "Dedication" });

/** The map opened from the world and unfolded whole: the open map of Lagos. */
async function openTheMap(page: Page): Promise<void> {
  await page.locator('[data-thumb="map"]').click();
  await page.waitForSelector("[data-map]");
  await mapIs(page, "ready");
  await page.locator("[data-strip]").click();
  await mapIs(page, "open");
  await expect(page.locator("[data-open-map]")).toBeVisible();
  // The unfolding's motion settles before anything is tapped or pictured.
  await page.waitForTimeout(500);
}

test("[R-WORLD-036] [R-ACCOUNT-032] in a life, the lantern canoe on the open map is no stop, opens the dedication page and folds nothing; offline the water is out of reach", async ({ page }) => {
  test.setTimeout(180_000);
  // The day's paint stood in (a development build's `?paint=`), so the first picture is the canoe by day whatever the hour.
  await page.goto(`/${LIVED}&paint=day`);
  await startReadyLife(page);
  await placeReady(page);
  await passHomeTeach(page);
  await openTheMap(page);

  const canoe = page.getByRole("button", { name: "A canoe with a lantern" });
  await expect(canoe).toBeVisible();
  // Not a stop: the probe lists it apart, and nothing on the strip or the cards draws it.
  const probe = await mapProbe(page);
  expect(probe?.canoe).not.toBeNull();
  expect(probe?.stops.some((stop) => stop.at[0] === probe.canoe?.[0] && stop.at[1] === probe.canoe[1])).toBe(false);
  await expect(page.locator("[data-canoe]")).toHaveCount(1);
  await expect(page.locator("[data-strip] [data-canoe], [data-card] [data-canoe]")).toHaveCount(0);
  // A hit area of at least 44 px, with one lantern while the account has no light.
  const box = await canoe.boundingBox();
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  await expect(canoe).toHaveAttribute("data-lanterns", "1");
  await shoot(page, "01-the-canoe-by-day");
  await page.evaluate(() => {
    document.documentElement.dataset.paint = "night";
  });
  await page.waitForTimeout(400);
  await expect(page.locator("[data-canoe-glow='night']")).toBeVisible();
  await shoot(page, "02-the-canoe-at-night");
  await page.evaluate(() => {
    document.documentElement.dataset.paint = "day";
  });

  await canoe.click();
  const dedication = dedicationPage(page);
  await expect(dedication).toBeVisible();
  await expect(dedication.getByText("soksonjr", { exact: true })).toBeVisible();
  await expect(dedication.getByText("For Osoko Emmanuel, 1998 to 2026. From Al-Ameen.", { exact: true })).toBeVisible();
  await expect(dedication.getByText("Sun re o.", { exact: true })).toBeVisible();
  // A build with no server has no water to read: the strings bare, no count, the button closed with its line.
  await expect(dedication.getByText("The water is out of reach right now.")).toBeVisible();
  await expect(dedication.locator("[data-dedication-count]")).toHaveCount(0);
  await dedication.getByRole("button", { name: "Close" }).click();
  await expect(dedication).toHaveCount(0);
  // The map stayed open: the canoe folds nothing.
  expect((await mapProbe(page))?.phase).toBe("open");
});

test("[R-CITY-021] [R-ACCOUNT-032] five taps on Settings' version line open the dedication page, offline; four do not", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/${LIVED}`);
  await startReadyLife(page);
  await placeReady(page);
  await passHomeTeach(page);
  const settings = await openApp(page, "settings");
  const version = settings.locator("[data-version] button");
  await version.scrollIntoViewIfNeeded();
  for (let tap = 0; tap < 4; tap += 1) await version.click();
  await expect(dedicationPage(page)).toHaveCount(0);
  await version.click();
  const dedication = dedicationPage(page);
  await expect(dedication).toBeVisible();
  await expect(dedication.getByText("soksonjr", { exact: true })).toBeVisible();
  await expect(dedication.getByText("Sun re o.", { exact: true })).toBeVisible();
  await expect(dedication.getByText("The water is out of reach right now.")).toBeVisible();
  await dedication.getByRole("button", { name: "Close" }).click();
  await expect(dedication).toHaveCount(0);
  await expect(settings).toBeVisible();
});

// ---------------------------------------------------------------------------------------------------------------------
// Online: the dedication's routes faked here as the server answers them (server.md R-SERVER-045, moderation.md
// R-MODERATION-021), one store for every page, so what one account lights another reads.
// ---------------------------------------------------------------------------------------------------------------------

interface Kept {
  account: string;
  id: string;
  name: string;
  from: number | null;
  to: number | null;
  litAt: number;
  approved: boolean;
}

/** The water as the design's picture has it: lights lit by others, a few named and approved. */
function water(): Kept[] {
  const named = ["Baba Segun", "Grandma", "Aunty Ronke", "Chidi", "Iya Bisi", "Uncle T"];
  return Array.from({ length: 305 }, (_, at) => ({ account: `account.other-${String(at)}`, id: `light.o${String(at)}`, name: named[at] ?? `Someone ${String(at)}`, from: null, to: null, litAt: 1_000 + at, approved: at < named.length }));
}

/** The shared read: the count, at most 240 lights with the approved named first, newest first, and the asker's own in full. */
function readOf(kept: readonly Kept[], account: string) {
  const ordered = [...kept].sort((a, b) => Number(b.approved) - Number(a.approved) || b.litAt - a.litAt);
  const own = kept.find((light) => light.account === account);
  return {
    ok: true,
    count: kept.length,
    lights: ordered.slice(0, 240).map((light) => (light.approved ? { id: light.id, name: light.name } : { id: light.id })),
    ...(own === undefined ? {} : { mine: { id: own.id, name: own.name, years: { from: own.from, to: own.to }, approved: own.approved } }),
  };
}

const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };

/** A page signed in as `account`: the game played through the simulation, the dedication's routes on the shared store. */
async function online(page: Page, account: string, kept: Kept[]): Promise<void> {
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  game.endTurn([]);
  game.grant(1);
  const view = () => ({ ok: true, view: game.view(), lines: [], clock: CLOCK });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const key = `${request.method()} ${path}`;
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (key === "GET /api/view") return json(view());
      if (key === "GET /api/moderation/standing") return json({ ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } });
      if (key === "GET /api/dedication/lights") return json(readOf(kept, account));
      if (key === "PUT /api/dedication/light") {
        const body = request.postDataJSON() as { name: string; from?: number; to?: number };
        const at = kept.findIndex((light) => light.account === account);
        if (at >= 0) kept.splice(at, 1);
        const light: Kept = { account, id: `light.${account}`, name: body.name, from: body.from ?? null, to: body.to ?? null, litAt: Date.now(), approved: false };
        kept.push(light);
        return json({ ok: true, mine: { id: light.id, name: light.name, years: { from: light.from, to: light.to }, approved: false } });
      }
      if (key === "DELETE /api/dedication/light") {
        const at = kept.findIndex((light) => light.account === account);
        if (at >= 0) kept.splice(at, 1);
        return json({ ok: true });
      }
      return json({ ok: false, code: "unknown-id", detail: "not faked" }, 404);
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  await page.goto(`${ONLINE}/`);
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  await passCards(page);
}

/** The admin page signed in as an admin: its own fixtures, and the lights list on the shared store. */
async function admin(page: Page, kept: Kept[]): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (path === "/api/admin/dedication/pending") {
        const waiting = kept.filter((light) => !light.approved).sort((a, b) => a.litAt - b.litAt).filter((light) => !light.account.startsWith("account.other-"));
        return json({ ok: true, lights: waiting.map((light) => ({ account: light.account, id: light.id, name: light.name, years: { from: light.from, to: light.to }, username: light.account.replace("account.", ""), region: "NG", litAt: light.litAt })) });
      }
      const decided = /^\/api\/admin\/dedication\/([^/]+)\/(approve|refuse)$/.exec(path);
      if (decided !== null && request.method() === "POST") {
        const at = kept.findIndex((light) => light.account === decodeURIComponent(decided[1] ?? ""));
        if (at < 0) return json({ ok: false, code: "unknown-id", detail: "No light." }, 404);
        if (decided[2] === "approve") kept[at] = { ...(kept[at] as Kept), approved: true };
        else kept.splice(at, 1);
        return json({ ok: true, entry: "log.dedication-1" });
      }
      const answer = ADMIN_GETS[path];
      return answer === undefined ? json({ ok: false }, 404) : json(answer);
    },
  );
  await page.goto(`${ONLINE}/admin`);
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible({ timeout: 30_000 });
}

async function context(browser: Browser) {
  return browser.newContext({ ...devices["Pixel 7"], ...SIZE });
}

test("[R-ACCOUNT-032] [R-ACCOUNT-033] [R-MODERATION-021] [R-WORLD-036] online: an account lights a light from the canoe's page and sees its name; another sees one more bare light and no name until the admin approves it; Put it out takes it away", async ({ browser }) => {
  test.setTimeout(300_000);
  const kept = water();
  const ada = await (await context(browser)).newPage();
  await online(ada, "account.ada", kept);
  await openTheMap(ada);
  await ada.getByRole("button", { name: "A canoe with a lantern" }).click();
  const page = dedicationPage(ada);
  await expect(page.locator("[data-dedication-count]")).toContainText("305 lights");
  await expect(page.locator("[data-light-name]").first()).toBeVisible();
  await ada.waitForTimeout(600);
  await shoot(ada, "08-the-strings-over-water");

  await page.getByRole("button", { name: "Light one for yours" }).click();
  await page.getByRole("textbox", { name: "Who is it for?" }).fill("Mama Nkechi");
  await page.getByRole("textbox", { name: "First year" }).fill("1951");
  await page.getByRole("textbox", { name: "Last year" }).fill("2024");
  await expect(page.locator("[data-unlit-name]")).toHaveText("yours");
  await ada.waitForTimeout(400);
  await shoot(ada, "05-name-it");
  await page.getByRole("button", { name: "Light it" }).click();
  await expect(page.locator("[data-own-light]")).toHaveText("Mama Nkechi1951 to 2024");
  await expect(page.locator("[data-dedication-count]")).toContainText("306 lights");
  await expect(page.getByText("Yours is on the water. Its name shows to everyone once it has been looked over.")).toBeVisible();
  await page.evaluate((element) => element.scrollTo({ top: 0 }), await page.elementHandle());
  await ada.waitForTimeout(500);
  await shoot(ada, "09-the-strings-with-yours");
  await page.locator("[data-put-out]").scrollIntoViewIfNeeded();
  await ada.waitForTimeout(300);
  await shoot(ada, "06-lit");
  await page.getByRole("button", { name: "Close" }).click();
  // The canoe carries a second lantern once the account's own light is lit.
  await expect(ada.locator("[data-canoe]")).toHaveAttribute("data-lanterns", "2");
  await ada.evaluate(() => {
    document.documentElement.dataset.paint = "night";
  });
  await ada.waitForTimeout(400);
  await shoot(ada, "07-the-canoe-with-yours");
  await ada.evaluate(() => {
    delete document.documentElement.dataset.paint;
  });

  // Another account: one more light on the water, bare, and no name.
  const bola = await (await context(browser)).newPage();
  await online(bola, "account.bola", kept);
  await openTheMap(bola);
  await expect(bola.locator("[data-canoe]")).toHaveAttribute("data-lanterns", "1");
  await bola.getByRole("button", { name: "A canoe with a lantern" }).click();
  const seen = dedicationPage(bola);
  await expect(seen.locator("[data-dedication-count]")).toContainText("306 lights");
  await expect(seen.getByText("Mama Nkechi")).toHaveCount(0);
  await seen.getByRole("button", { name: "Close" }).click();

  // The admin approves it on the admin page's moderation tab.
  const owner = await (await context(browser)).newPage();
  await admin(owner, kept);
  await owner.getByRole("tab", { name: "Moderation" }).click();
  const list = owner.getByRole("list", { name: "Lights awaiting a look" });
  await expect(list).toBeVisible();
  const item = list.locator("[data-light='account.ada']");
  await expect(item).toContainText("Mama Nkechi");
  await expect(item).toContainText("1951 to 2024");
  await item.scrollIntoViewIfNeeded();
  await shoot(owner, "10-admin-lights");
  await item.getByRole("button", { name: "Approve" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Send" }).click();
  await expect(owner.getByText("No light awaits a look.")).toBeVisible();

  // The second account now sees the name.
  await bola.getByRole("button", { name: "A canoe with a lantern" }).click();
  await expect(seen.locator("[data-light-name]", { hasText: "Mama Nkechi" })).toBeVisible();
  await seen.getByRole("button", { name: "Close" }).click();

  // Put it out: the light goes and the button returns.
  await ada.getByRole("button", { name: "A canoe with a lantern" }).click();
  await page.getByRole("button", { name: "Put it out" }).click();
  await expect(page.getByRole("button", { name: "Light one for yours" })).toBeVisible();
  await expect(page.locator("[data-dedication-count]")).toContainText("305 lights");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(ada.locator("[data-canoe]")).toHaveAttribute("data-lanterns", "1");
});
