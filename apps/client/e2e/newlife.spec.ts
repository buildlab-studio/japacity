import type { PresetRequest } from "@japacity/api";
import type { Command, Id, PlayerView, ReportLine } from "@japacity/sim";
import { worldClockAt } from "@japacity/sim";
import { start, type Game } from "@japacity/sim/testing";

import { expect, test, type Page } from "@playwright/test";

// "Start a new life" online (docs/rules/account.md R-ACCOUNT-030): a guest in the world opens Settings, the sheet
// names the character, a tap does nothing and a hold ends the life through the server's own route; the front door
// opens filled in, and Begin starts the new life under the same guest, with no bot check and no new guest asked
// for. Played against a faked server that runs the simulation itself, as asks.spec.ts does.
import { content } from "../../../packages/content/src/index";
import { playPresetOn } from "../src/shared/net/preset.testing";
import { passOpeningWords, startArchetype } from "./support/door";
import { passCards } from "./support/live";
import { shootPhone } from "./support/preview";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });

/** The pictures are phone pictures at 390 by 844. */
const GUEST = { id: "account-guest", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state: "guest", username: "ada_lagos", renameFrom: 0 };
const STANDING = { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } };

function clock(game: Game) {
  return { tick: game.tick, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
}

function viewOf(game: Game): { ok: true; view: PlayerView; lines: ReportLine[]; clock: ReturnType<typeof clock> } {
  if (game.state.turn.banked === 0) game.grant(1);
  return { ok: true, view: game.view(), lines: [], clock: clock(game) };
}

/** Every /api route the client calls, answered from the one life the faked account holds; every request is kept. */
async function fakeServer(page: Page): Promise<{ sent: string[]; scenarios: Id<"scenario">[] }> {
  let game: Game | null = start({ scenario: "scenario.tunde", content });
  const sent: string[] = [];
  const scenarios: Id<"scenario">[] = [];
  const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const asked = `${request.method()} ${new URL(request.url()).pathname}`;
      sent.push(asked);
      if (asked === "GET /api/view") return route.fulfill(game === null ? json({ ok: false, code: "no-character", detail: "No character yet." }, 404) : json(viewOf(game)));
      if (asked === "POST /api/character/end") {
        game = null;
        return route.fulfill(json({ ok: true }));
      }
      if (asked === "POST /api/character") {
        if (game !== null) return route.fulfill(json({ ok: false, code: "one-character", detail: "This account already has a character." }, 409));
        const { scenario } = request.postDataJSON() as { scenario: Id<"scenario"> };
        scenarios.push(scenario);
        game = start({ scenario, content });
        return route.fulfill(json(viewOf(game)));
      }
      if (asked === "POST /api/command" && game !== null) {
        const { command } = request.postDataJSON() as { command: Command };
        const result = game.send(command);
        if (!result.ok) return route.fulfill(json({ ok: false, code: result.code, detail: result.detail }, 409));
        return route.fulfill(json({ ...viewOf(game), lines: result.lines }));
      }
      // R-SERVER-046: Begin sends the new life's preset once, played here as the server plays it.
      if (asked === "POST /api/prologue/preset" && game !== null) {
        return route.fulfill(json(playPresetOn(game, request.postDataJSON() as PresetRequest, { ...clock(game), morningAt: 0, world: worldClockAt(game.tick) })));
      }
      if (asked === "GET /api/account") return route.fulfill(json({ ok: true, account: { ...GUEST, character: game === null ? null : "c-1" } }));
      if (asked === "GET /api/moderation/standing") return route.fulfill(json(STANDING));
      return route.fulfill(json({ ok: false, code: "unknown-id", detail: "not faked" }, 404));
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.route("https://challenges.cloudflare.com/**", (route) => {
    sent.push("turnstile");
    return route.abort();
  });
  return { sent, scenarios };
}

test("[R-ACCOUNT-030] a guest ends the life from Settings by a hold, the door opens filled in, and Begin starts the new life under the same guest", async ({ page }, info) => {
  // The hold, the door and the years of the new page as the faked server plays them, which a loaded machine stretches.
  test.setTimeout(120_000);
  if (info.project.name.startsWith("Pixel")) await page.setViewportSize({ width: 390, height: 844 });
  const faked = await fakeServer(page);
  await page.goto("/");
  await passOpeningWords(page, 20_000);

  await passCards(page);
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator('[data-app="settings"]').click();
  const entry = page.locator("[data-life-end]");
  await entry.scrollIntoViewIfNeeded();
  await shootPhone(page, "newlife-01-settings", info.project.name);
  await entry.click();

  const sheet = page.getByRole("dialog", { name: "Start a new life" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-life-end-who]")).toContainText("yrs");
  await expect(sheet.getByText("This life ends here, and it cannot be brought back.")).toBeVisible();
  await expect(sheet.getByRole("textbox")).toHaveCount(0);
  await shootPhone(page, "newlife-02-sheet", info.project.name);

  // A tap is not a hold.
  const ending = sheet.getByRole("button", { name: "Hold to end this life" });
  await ending.click();
  await page.waitForTimeout(300);
  expect(faked.sent).not.toContain("POST /api/character/end");

  const box = await ending.boundingBox();
  if (box === null) throw new Error("The ending button has no box.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await shootPhone(page, "newlife-03-holding", info.project.name);
  await page.waitForTimeout(1_100);
  await page.mouse.up();
  await expect.poll(() => faked.sent.includes("POST /api/character/end")).toBe(true);

  // The front door, filled in as onboarding is.
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#door-name")).not.toHaveValue("");
  await shootPhone(page, "newlife-04-door", info.project.name);

  await startArchetype(page, "The developer");
  await expect(page.locator('[data-thumb="phone"]')).toBeVisible({ timeout: 30_000 });
  await passOpeningWords(page, 20_000);
  await shootPhone(page, "newlife-05-world", info.project.name);

  expect(faked.scenarios).toHaveLength(1);
  expect(faked.sent).not.toContain("POST /api/guest");
  expect(faked.sent).not.toContain("turnstile");
});

test("[R-CITY-021] a guest opens the Credits from the phone's Settings: the same sheet as the city's menu, with the map data linked", async ({ page }) => {
  await fakeServer(page);
  await page.goto("/");
  await passOpeningWords(page, 20_000);
  await passCards(page);
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator('[data-app="settings"]').click();
  const row = page.locator("[data-credits-row]");
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const sheet = page.getByRole("dialog", { name: "Credits" });
  await expect(sheet.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(sheet.getByText("Sound and art from others")).toBeVisible();
});
