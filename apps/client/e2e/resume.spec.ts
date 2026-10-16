import { join } from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

// The online start that never dies (docs/rules/engine.md R-ENGINE-015, account.md R-ACCOUNT-006): a reload at each
// step of the door comes back where the run or the life stands; a request with no answer shows the card, never the
// browser's own words; a login wall reloads the page once and then shows the card with Reload. Played against a faked
// server that runs the simulation itself, as newlife.spec.ts does.
import { content } from "../../../packages/content/src/index";
import type { Command, Id, PlayerView, ReportLine } from "../../../packages/sim/src/engine/types";
import { worldClockAt } from "../../../packages/sim/src/index";
import { start, type Game } from "../../../packages/sim/src/testing/play";
import type { PresetRequest } from "../src/shared/net/contract";
import { playPresetOn } from "../src/shared/net/preset.testing";
import { passOpeningWords } from "./door";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });
test.setTimeout(120_000);

const PREVIEW = process.env.PREVIEW_DIR;

async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "" || !project.startsWith("Pixel")) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PREVIEW, `${name}.png`), fullPage: false });
}

const ACCOUNT = { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, admin: false, state: "secured", username: "ada_lagos", renameFrom: 0 };
const STANDING = { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } };
const ACCESS_LOGIN = "https://example-team.cloudflareaccess.com/cdn-cgi/access/login/staging.japacity.app?redirect_url=%2Fapi%2Fview";

function clock(game: Game) {
  return { tick: game.tick, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
}

function viewOf(game: Game): { ok: true; view: PlayerView; lines: ReportLine[]; clock: ReturnType<typeof clock> } {
  if (game.state.turn.banked === 0) game.grant(1);
  return { ok: true, view: game.view(), lines: [], clock: clock(game) };
}

interface Faked {
  sent: string[];
  scenarios: Id<"scenario">[];
  /** The life the server holds, once Begin is answered. */
  game: () => Game | null;
  /** Answers held back or broken by the test, by `METHOD /path`; returning true means it answered the route itself. */
  hold: Map<string, (route: Route) => Promise<boolean>>;
}

/** Every /api route answered from the one life the account holds, kept across reloads, as the server keeps it. */
async function fakeServer(page: Page, commandDelayMs = 0): Promise<Faked> {
  let game: Game | null = null;
  const sent: string[] = [];
  const scenarios: Id<"scenario">[] = [];
  const hold = new Map<string, (route: Route) => Promise<boolean>>();
  const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const asked = `${request.method()} ${new URL(request.url()).pathname}`;
      sent.push(asked);
      const held = hold.get(asked);
      if (held !== undefined && (await held(route))) return;
      if (asked === "GET /api/view") return route.fulfill(game === null ? json({ ok: false, code: "no-character", detail: "No character yet." }, 404) : json(viewOf(game)));
      if (asked === "POST /api/character") {
        if (game !== null) return route.fulfill(json({ ok: false, code: "one-character", detail: "This account already has a character." }, 409));
        const { scenario } = request.postDataJSON() as { scenario: Id<"scenario"> };
        scenarios.push(scenario);
        game = start({ scenario, content });
        return route.fulfill(json(viewOf(game)));
      }
      if (asked === "POST /api/command" && game !== null) {
        if (commandDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, commandDelayMs));
        const { command } = request.postDataJSON() as { command: Command };
        // R-ENGINE-003: a command on an older version is refused stale, as the server does.
        if (command.basedOn !== game.view().v) return route.fulfill(json({ ok: false, code: "stale", detail: "The state moved on." }, 409));
        const result = game.send(command);
        if (!result.ok) return route.fulfill(json({ ok: false, code: result.code, detail: result.detail }, 409));
        return route.fulfill(json({ ...viewOf(game), lines: result.lines }));
      }
      // R-SERVER-046: Begin sends the new life's preset once, played here as the server plays it, after the same delay a command takes.
      if (asked === "POST /api/prologue/preset" && game !== null) {
        if (commandDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, commandDelayMs));
        return route.fulfill(json(playPresetOn(game, request.postDataJSON() as PresetRequest, { ...clock(game), morningAt: 0, world: worldClockAt(game.tick) })));
      }
      if (asked === "GET /api/account") return route.fulfill(json({ ok: true, account: { ...ACCOUNT, character: game === null ? null : "c-1" } }));
      if (asked === "GET /api/moderation/standing") return route.fulfill(json(STANDING));
      return route.fulfill(json({ ok: false, code: "unknown-id", detail: "not faked" }, 404));
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  return { sent, scenarios, game: () => game, hold };
}

/** No words on screen are the browser's own. */
async function noBrowserWords(page: Page): Promise<void> {
  const shown = await page.locator("body").innerText();
  expect(shown).not.toContain("Load failed");
  expect(shown).not.toContain("Failed to fetch");
  expect(shown).not.toContain("could not start");
}

test("[R-ENGINE-015] a reload at each step of the door comes back to that step filled in; after Begin a reload mid-years opens the life where it stands and the years go on to the world", async ({ page }, info) => {
  const faked = await fakeServer(page, 350);
  await page.goto("/");

  const name = page.locator("#door-name");
  await name.fill("Adaeze", { timeout: 30_000 });
  await page.reload();
  await expect(page.locator("#door-name")).toHaveValue("Adaeze", { timeout: 30_000 });
  await shoot(page, "resume-01-you-after-reload", info.project.name);

  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.getByRole("radio", { name: "The developer", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "The developer", exact: true })).toBeChecked({ timeout: 30_000 });
  await shoot(page, "resume-02-life-after-reload", info.project.name);

  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await expect(page.locator("[data-gate='page']")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-gate='page']")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-gate='page']")).toContainText("Adaeze");
  await shoot(page, "resume-03-page-after-reload", info.project.name);
  expect(faked.sent).not.toContain("POST /api/character");

  await page.getByRole("button", { name: /^Begin/ }).click();
  await expect(page.locator("[data-gate='years']")).toBeVisible({ timeout: 30_000 });
  // The years are in (the preset played by the server in one request, R-SERVER-046): the server holds the life, and the page is reloaded while its chips still come in.
  await expect.poll(() => faked.sent.filter((asked) => asked === "POST /api/prologue/preset").length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  await shoot(page, "resume-04-years-before-reload", info.project.name);
  await page.reload();
  await expect(page.locator("[data-gate='years'], [data-gate='handover'], [data-thumb='phone']").first()).toBeVisible({ timeout: 30_000 });
  await shoot(page, "resume-05-years-after-reload", info.project.name);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toHaveCount(0);

  const go = page.locator("[data-page-handover]").getByRole("button", { name: "Go", exact: true });
  await go.or(page.locator("[data-thumb='phone']")).first().waitFor({ state: "visible", timeout: 60_000 });
  if (await go.isVisible()) await go.click();
  await expect(page.locator("[data-thumb='phone']")).toBeVisible({ timeout: 30_000 });
  await passOpeningWords(page, 20_000);
  await shoot(page, "resume-06-world", info.project.name);
  expect(faked.scenarios).toHaveLength(1);
  expect(faked.game()?.view().prologue).toBeNull();
  await noBrowserWords(page);
});

test("[R-ENGINE-015] Begin with no answer shows the card over the door, a reload keeps the page filled in, and Retry begins the life", async ({ page }, info) => {
  const faked = await fakeServer(page);
  let broken = true;
  faked.hold.set("POST /api/character", async (route) => {
    if (!broken) return false;
    await route.abort("failed");
    return true;
  });
  await page.goto("/");
  await page.locator("#door-name").fill("Tobi", { timeout: 30_000 });
  await page.getByRole("button", { name: /^Next/ }).first().click();
  await page.getByRole("radio", { name: "The developer", exact: true }).click();
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await page.getByRole("button", { name: /^Begin/ }).click();

  const card = page.getByRole("alertdialog", { name: "The server did not answer." });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole("button", { name: "Reload" })).toHaveCount(0);
  await noBrowserWords(page);
  await shoot(page, "resume-07-begin-no-answer", info.project.name);

  await page.reload();
  await expect(page.locator("[data-gate='page']")).toContainText("Tobi", { timeout: 30_000 });
  await page.getByRole("button", { name: /^Begin/ }).click();
  await expect(card).toBeVisible({ timeout: 30_000 });
  broken = false;
  await card.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("[data-gate='years'], [data-gate='handover']").first()).toBeVisible({ timeout: 30_000 });
  expect(faked.scenarios).toHaveLength(1);
});

test("[R-ENGINE-015] a slow start for a player whose life is kept on this device says Still opening, and a view that never comes shows the card with Retry", async ({ page }, info) => {
  const faked = await fakeServer(page);
  // "Opening your life" and its "Still opening..." are for a player this device keeps a life for (R-ENGINE-015, amended
  // 11 Oct 2026); a new visitor sees the start screen's frame instead, as the next test proves.
  await page.addInitScript(() => localStorage.setItem("japacity.person", JSON.stringify({ look: "chr_ada", name: "Bayo", archetype: "developer" })));
  let slow = true;
  // Each read waits six seconds before it fails, so the second line has its turn before the card.
  faked.hold.set("GET /api/view", async (route) => {
    if (!slow) return false;
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    await route.abort("failed");
    return true;
  });
  await page.goto("/");
  await expect(page.getByText("Still opening...")).toBeVisible({ timeout: 15_000 });
  await shoot(page, "resume-08-still-opening", info.project.name);
  const card = page.getByRole("alertdialog", { name: "The server did not answer." });
  await expect(card).toBeVisible({ timeout: 40_000 });
  await noBrowserWords(page);
  await shoot(page, "resume-09-view-no-answer", info.project.name);
  slow = false;
  await card.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#door-name")).toBeVisible({ timeout: 30_000 });
});

test("[R-ENGINE-015] a new visitor with no life on this device never sees Opening your life while the view is slow: the start screen's frame stands, and the card comes in it with Retry", async ({ page }) => {
  const faked = await fakeServer(page);
  let slow = true;
  faked.hold.set("GET /api/view", async (route) => {
    if (!slow) return false;
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    await route.abort("failed");
    return true;
  });
  await page.goto("/");
  const card = page.getByRole("alertdialog", { name: "The server did not answer." });
  await expect(card).toBeVisible({ timeout: 40_000 });
  await expect(page.locator("[data-start-trouble]")).toBeVisible();
  await expect(page.getByText("Opening your life")).toHaveCount(0);
  await expect(page.getByText("Still opening...")).toHaveCount(0);
  await noBrowserWords(page);
  slow = false;
  await card.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#door-name")).toBeVisible({ timeout: 30_000 });
});

test("[R-ACCOUNT-006] a login wall in front of /api reloads the page once; a second wall within a minute shows the card with Reload instead", async ({ page }, info) => {
  const faked = await fakeServer(page);
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });
  // Access stands in front of the whole host: every /api route answers with its redirect (the last route set is asked first).
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      faked.sent.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 302, headers: { location: ACCESS_LOGIN }, body: "" });
    },
  );
  await page.route("https://example-team.cloudflareaccess.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Access login</p>" }));
  await page.goto("/");
  const card = page.getByRole("alertdialog", { name: "Your session ended: open the game again." });
  await expect(card).toBeVisible({ timeout: 30_000 });
  // One load, one reload for the wall, and no more.
  expect(navigations).toBe(2);
  expect(faked.sent.filter((asked) => asked === "GET /api/view").length).toBeGreaterThanOrEqual(2);
  await expect(card.getByRole("button", { name: "Reload" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Retry" })).toBeVisible();
  await noBrowserWords(page);
  await shoot(page, "resume-10-wall-card", info.project.name);
  await page.waitForTimeout(1_000);
  expect(navigations).toBe(2);
});
