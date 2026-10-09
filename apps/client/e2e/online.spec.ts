import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The client built against a server is played here against a faked one: every
// /api route is answered by the page's own route handler, in the shapes
// apps/client/src/shared/net/contract.ts copies from the server.
import { content } from "../../../packages/content/src/index";
import { start, type Game } from "../../../packages/sim/src/testing/play";

/** The second dev server, built with VITE_SERVER_URL pointing at itself, so every /api request is same-origin and faked here. */
const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });

const PREVIEW = process.env.PREVIEW_DIR;
const CODE = "4f1e2d3c4b5a69788796a5b4";
const PAIR = "pair-1";
const THEM = "character-them";

async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "") return;
  const size = project.startsWith("Pixel") ? "phone" : "desktop";
  await page.screenshot({ path: join(PREVIEW, `${name}-${size}.png`), fullPage: false });
}

type Answer = { status?: number; body: unknown; type?: string };

const SIGNED_OUT: Answer = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };

/** A stand-in for Cloudflare's widget: it passes at once with the dummy token, as the always-pass test key does. */
const TURNSTILE = `window.turnstile = {
  render(container, options) {
    const box = document.createElement("div");
    box.textContent = "Check passed";
    box.style.cssText = "border:1px solid #bbb;border-radius:6px;padding:10px 12px;font:14px system-ui;width:max-content";
    container.append(box);
    setTimeout(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"), 0);
    return "widget-1";
  },
  reset() {},
  remove() {},
};`;

/** A fictional business's poster, drawn here so the tile has something to show. */
const POSTER = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#f4c430"/>
  <circle cx="128" cy="118" r="62" fill="#c0392b"/>
  <text x="128" y="126" font-family="Georgia, serif" font-size="30" fill="#fff8e7" text-anchor="middle">Jollof</text>
  <text x="128" y="214" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#2b1d0e" text-anchor="middle">Mama Put Kitchen</text>
</svg>`;

/** Answers every /api route from `answers`, by method and path; the nudge socket opens and stays quiet. */
async function fakeServer(page: Page, answers: Record<string, Answer>): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const answer = answers[`${request.method()} ${new URL(request.url()).pathname}`];
      if (answer === undefined) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, code: "unknown-id", detail: "not faked" }) });
      return route.fulfill({ status: answer.status ?? 200, contentType: answer.type ?? "application/json", body: typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body) });
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: TURNSTILE }));
}

function viewOf(game: Game): Answer {
  if (game.state.turn.banked === 0) game.grant(1);
  return { body: { ok: true, view: game.view(), lines: [], clock: CLOCK } };
}

/** On a phone a panel is behind its tab; on a desktop every panel shows and the tab bar is hidden. */
async function openTab(page: Page, name: string): Promise<void> {
  const tabs = page.getByRole("navigation", { name: "Sections" });
  // The bar is there once the shell has drawn; right after a reload it is not yet, and its absence would read as a desktop.
  await page.getByRole("banner").waitFor();
  if (await tabs.isVisible()) await tabs.getByRole("button", { name }).click();
}

function friendGame(): Game {
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  game.endTurn([]);
  game.accept({ type: "people/invite", slot: "partner", looking: "partner", fill: "already-in-uk" });
  game.accept(
    {
      type: "people/link",
      slot: "partner",
      pair: PAIR,
      facts: {
        label: "player",
        ageMonths: 340,
        where: "abroad",
        country: "country.uk",
        status: "status.uk-settled",
        statusMonthsLeft: null,
        monthsInCountry: 30,
        job: "activity.job-uk-senior-care",
        meetsFloor: { "route.uk-partner": true },
        eduLevel: 3,
        englishBand: 70,
        home: "town",
        joint: null,
        funds: null,
        assistanceTaken: 0,
        sponsorReady: "route.uk-partner",
      },
    },
    "authority",
  );
  return game;
}

test("[R-SERVER-032] while sign-ups are switched off, a new visitor sees the full screen and no way in", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": SIGNED_OUT,
    "GET /api/age": { status: 503, body: { ok: false, code: "switched-off", detail: "Sign-ups are closed for now.", retryAfter: 30 } },
  });
  await page.goto("/?classic");
  await expect(page.getByRole("heading", { name: "Japacity is full right now. Try again shortly." })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Check again" })).toBeDisabled();
  await expect(page.getByLabel("Date of birth")).toHaveCount(0);
  await shoot(page, "full", info.project.name);
});

test("[R-PAIR-008] an invite link shows the friend's card before sign-up, with its report control, then the age screen and the ways in", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": SIGNED_OUT,
    [`GET /api/invite/${CODE}`]: {
      body: {
        ok: true,
        slot: "partner",
        looking: "partner",
        expires: Date.now() + 14 * 86_400_000,
        card: { name: "scenario.tunde.name", japacity: { percent: 47, route: "route.uk-masters" }, looking: { key: "card.invite.looking", slot: "partner", fill: "already-in-uk", slotKey: "card.invite.slot.partner", fillKey: "card.invite.fill.already-in-uk" }, game: "card.invite.game", controls: ["block", "report"] },
      },
    },
    "POST /api/age": { body: { ok: true } },
  });
  await page.goto(`/invite/${CODE}`);
  const card = page.getByRole("figure");
  await expect(card).toContainText("Looking for: a partner already in the UK", { timeout: 20_000 });
  await expect(card).toContainText("Japacity is a game");
  await expect(page.locator('[data-moderation="invite-card"]').getByRole("button", { name: "Report" })).toBeVisible();
  await expect(page.getByLabel("Date of birth")).toBeVisible();
  await expect(page.locator("[data-advert-slot]")).toHaveCount(0);
  await shoot(page, "invite", info.project.name);

  await page.getByLabel("Date of birth").fill("1994-03-12");
  await expect(page.getByText("Check passed")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await shoot(page, "invite-ways-in", info.project.name);
});

test("[R-MODERATION-003] a friend's conversation carries block and report, and a report offers a block ticked", async ({ page }, info) => {
  const game = friendGame();
  await fakeServer(page, {
    "GET /api/view": viewOf(game),
    [`GET /api/pair/${PAIR}`]: { body: { ok: true, pair: { id: PAIR, side: "a", them: THEM } } },
    [`GET /api/pair/${PAIR}/conversation`]: {
      body: {
        ok: true,
        pair: PAIR,
        messages: [
          { id: "m1", conversation: PAIR, sender: THEM, phrase: "phrase.hello", fill: null, sentAt: Date.now() - 60_000, readAt: null },
          { id: "m2", conversation: PAIR, sender: "character-me", phrase: "phrase.meet-at", fill: "suya-spot", sentAt: Date.now() - 30_000, readAt: Date.now() - 20_000 },
        ],
      },
    },
    "GET /api/moderation/standing": { body: { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } } },
  });
  await page.goto("/?classic");
  await expect(page.getByRole("heading", { name: /^Month \d+$/ }).first()).toBeVisible({ timeout: 20_000 });
  await openTab(page, "People");
  const thread = page.locator(`[data-conversation="${PAIR}"]`);
  await expect(thread.locator('[data-row="m1"]')).toBeVisible();
  await expect(thread.locator('[data-moderation="conversation"]').getByRole("button", { name: "Block" })).toBeVisible();
  await expect(page.locator('[data-moderation="pair"]')).toBeVisible();
  await thread.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await shoot(page, "conversation", info.project.name);

  await thread.locator('[data-moderation="conversation"]').getByRole("button", { name: "Report" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("checkbox", { name: "Block them too" })).toBeChecked();
  await expect(sheet.getByRole("button", { name: "Scam or asking for money" })).toBeVisible();
  await shoot(page, "conversation-report", info.project.name);
});

test("[R-ADVERT-002] the phone tile shows the hour's sponsored tile with the game's own label, and its card can be reported", async ({ page }, info) => {
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  game.endTurn([]);
  await fakeServer(page, {
    "GET /api/view": viewOf(game),
    "GET /api/account": { body: { ok: true, account: { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1" } } },
    "GET /api/adverts": {
      body: {
        ok: true,
        region: "NG",
        hour: 1,
        until: Date.now() + 3_600_000,
        slots: { "advert.phone-tile": { campaign: "campaign-1", creative: "creative-1", version: 1, image: "/api/adverts/image/creative-1/1", width: 256, height: 256, advertiser: "Mama Put Kitchen", text: "Jollof and plantain on the island, open late.", link: null } },
      },
    },
    "GET /api/adverts/image/creative-1/1": { body: POSTER, type: "image/svg+xml" },
    "GET /api/moderation/standing": { body: { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } } },
  });
  await page.goto("/?classic");
  await expect(page.getByRole("heading", { name: /^Month \d+$/ }).first()).toBeVisible({ timeout: 20_000 });
  await openTab(page, "News");
  const tile = page.locator("[data-advert-slot='advert.phone-tile']");
  await expect(tile).toBeVisible();
  await expect(tile.getByText("Advert")).toBeVisible();
  // The action bar and the tab bar cover the foot of a phone's screen, so the tile is brought to the middle.
  await tile.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await shoot(page, "phone-tile", info.project.name);

  await tile.getByRole("button").click();
  const card = page.getByRole("dialog");
  await expect(card).toContainText("Jollof and plantain on the island, open late.");
  await expect(card.locator('[data-moderation="advert"]').getByRole("button", { name: "Report" })).toBeVisible();
  await shoot(page, "advert-card", info.project.name);
});
