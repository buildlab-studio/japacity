import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The client built against a server is played here against a faked one: every
// /api route is answered by the page's own route handler, in the shapes
// apps/client/src/shared/net/contract.ts copies from the server.
import { content } from "../../../packages/content/src/index";
import { standInWorld } from "../../../packages/sim/src/index";
import type { Command, World } from "../../../packages/sim/src/index";
import { start, type Game } from "../../../packages/sim/src/testing/play";
import { passOpeningWords } from "./door";

/** The second dev server, built with VITE_SERVER_URL pointing at itself, so every /api request is same-origin and faked here. */
const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
// The world's scene needs WebGL, drawn in software where the machine has no GPU (as world.spec.ts draws it).
test.use({ baseURL: ONLINE, launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

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
/** An answer worked out from the request's body when it comes: a command played through the game. */
type Answering = (body: unknown) => Answer;

const SIGNED_OUT: Answer = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };

/** A stand-in for Cloudflare's widget: it passes at once with the dummy token, as the always-pass test key does, and draws nothing when asked to show only for a tap (R-ACCOUNT-029). */
const TURNSTILE = `window.turnstile = {
  render(container, options) {
    const box = document.createElement("div");
    box.textContent = "Check passed";
    box.style.cssText = "border:1px solid #bbb;border-radius:6px;padding:10px 12px;font:14px system-ui;width:max-content";
    if (options.appearance !== "interaction-only") container.append(box);
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
async function fakeServer(page: Page, answers: Record<string, Answer | Answering>): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const found = answers[`${request.method()} ${new URL(request.url()).pathname}`];
      const answer = typeof found === "function" ? found(request.postDataJSON()) : found;
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
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await shoot(page, "full", info.project.name);
});

test("[R-PAIR-008] [R-ACCOUNT-029] an invite link shows the friend's card before sign-up, with its report control, then the age screen, the username with the guest line under it, and the ways back in", async ({ page }, info) => {
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
  await expect(page.getByRole("combobox", { name: "Day" })).toBeVisible();
  await expect(page.locator("[data-advert-slot]")).toHaveCount(0);
  await shoot(page, "invite", info.project.name);

  await page.getByRole("combobox", { name: "Day" }).selectOption("12");
  await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "March" });
  await page.getByRole("combobox", { name: "Year" }).selectOption("1994");
  // The bot check runs unseen (R-ACCOUNT-029).
  await expect(page.getByText("Check passed")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  // R-ACCOUNT-021, 013: the card makes the life here, so the username stands under the age screen, the check unseen; a friend who kept a life goes to the ways back in.
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByText("This life lives only on this phone until you keep it.")).toHaveCount(1);
  await expect(page.getByText("Check passed")).toHaveCount(0);
  await shoot(page, "invite-username", info.project.name);
  await page.getByRole("button", { name: "I already have a life here" }).click();
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

/** Tunde, online, in a world whose Friday draw is on sale: draw 7, closing at tick 14, with nothing sold to him yet. */
function drawGame(): Game {
  const base = standInWorld("world-1", 0, content);
  const lottery: World["lottery"] = {
    draw: 7,
    closesTick: 14,
    onSale: true,
    fingerprint: "ab".repeat(32),
    beaconRound: 1234,
    salesSoFar: 0,
    jackpot: content.tuning.lottery.odds.jackpotStart,
    rolledOver: false,
    odds: content.tuning.lottery.odds,
    last: null,
  };
  const game = start({ scenario: "scenario.tunde", content, worldAt: (tick) => ({ tick, rates: base.rates, vars: base.vars, news: [], era: null, lottery, placeNames: {} }) });
  game.grant(1);
  return game;
}

test.describe("the street kiosk while the world runs the Friday draw", () => {
  test("[R-LOTTERY-001] [R-WORLD-005] [R-WORLD-006] the kiosk on Bode Thomas Street opens the Friday draw's sheet, and one ticket is bought from it in the world", async ({ page }, info) => {
    test.setTimeout(300_000);
    const game = drawGame();
    const sent: Command[] = [];
    await fakeServer(page, {
      "GET /api/view": () => viewOf(game),
      "POST /api/command": (body) => {
        const { command } = body as { command: Command };
        sent.push(command);
        // The handle bases the command on its own state, as the server does on its stored one.
        const result = game.send(command);
        return result.ok ? { body: { ok: true, view: game.view(), lines: result.lines, clock: CLOCK } } : { status: 409, body: result };
      },
    });
    // The life stands on Bode Thomas Street, where the kiosk is (city.md R-CITY-013: the last place stood in opens).
    await page.addInitScript(() => {
      window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.bode-thomas"]));
      window.localStorage.setItem("japacity.city.graphics", "high");
    });
    await page.goto("/");
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(
      () => {
        const city = (window as unknown as { __city?: { place: string; ready: boolean; frames: number[] } }).__city;
        return city !== undefined && city.ready && city.place === "place.bode-thomas" && city.frames.length > 3;
      },
      null,
      { timeout: 120_000 },
    );
    await passOpeningWords(page);
    const teach = page.locator("[data-home-teach-ok]");
    if (await teach.isVisible().catch(() => false)) await teach.click();

    // The kiosk keeps its name and its act; the tap opens the draw's sheet, never the offline slip.
    await page.locator('[data-mark="kiosk"]').click();
    const chip = page.locator('[data-thing-chip="kiosk"]');
    await expect(chip).toBeVisible();
    await chip.locator("[data-act]").first().click();
    const sheet = page.locator('[data-world-sheet="kiosk"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-ask-form]")).toHaveCount(0);
    await expect(sheet).toContainText("The Friday draw");
    await expect(sheet.locator("[data-lottery-close]")).toBeVisible();
    await expect(sheet.locator("[data-lottery-odds]")).toHaveCount(0);

    // Two picked: the button says the act and its cost, paid now.
    await sheet.getByRole("button", { name: "One more ticket" }).click();
    const buy = page.locator("[data-kiosk-buy]");
    await expect(buy).toContainText("Buy 2 tickets");
    await expect(buy).toContainText("paid now");
    await shoot(page, "kiosk-online", info.project.name);
    // The odds fold behind their row (R-WORLD-006).
    await sheet.locator('[data-kiosk-fold="odds"] button').click();
    await expect(sheet.locator("[data-lottery-odds]")).toBeVisible();
    await sheet.locator('[data-kiosk-fold="odds"]').scrollIntoViewIfNeeded();
    await shoot(page, "kiosk-online-odds", info.project.name);

    // One ticket bought from the kiosk: lottery/buy goes to the server, and the sheet says the ticket is held.
    await sheet.getByRole("button", { name: "One fewer ticket" }).click();
    await expect(buy).toContainText("Buy 1 ticket");
    await buy.click();
    await expect(sheet.locator("[data-lottery-held]")).toHaveAttribute("data-lottery-held", "1");
    expect(sent.filter((command) => command.type === "lottery/buy")).toEqual([expect.objectContaining({ type: "lottery/buy", tickets: 1 })]);
    expect(sent.some((command) => command.type === "activity/now")).toBe(false);
  });
});

test("[R-WORLD-020] [R-PEOPLE-009] [R-PEOPLE-013] in the world on a phone, Tobi stands in the family house's parlour with the computer mark; his card's button courts him, and his thread in Chats opens with the bond's head", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The world is checked at phone size.");
  test.setTimeout(120_000);
  const TOBI = "person.tobi-bank";
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  game.endTurn([]);
  const before = viewOf(game);
  expect(game.view().people.candidates.map((candidate) => candidate.person)).toContain(TOBI);
  const result = game.accept({ type: "people/court", with: TOBI });
  const after = { ok: true, view: game.view(), lines: result.lines, clock: CLOCK };
  const bond = after.view.people.bonds.find((one) => one.person === TOBI)?.id ?? "";
  const sent: unknown[] = [];
  let courted = false;
  await fakeServer(page, {
    "GET /api/view": () => (courted ? { body: after } : before),
    "GET /api/moderation/standing": { body: { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } } },
    "POST /api/command": () => {
      courted = true;
      return { body: after };
    },
  });
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/command") sent.push(request.postDataJSON());
  });
  // The world opens at home, the family house, where the people met after the service come home with the family.
  await page.addInitScript(() => {
    localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
    localStorage.setItem("japacity.walkthrough", "1");
  });
  await page.goto("/");
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 30_000 });
  await passOpeningWords(page);
  // The home's teach card, once in a life (R-HOME-008), is put away so the parlour is clear.
  const teach = page.locator("[data-home-teach-ok]");
  if (await teach.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) await teach.click();
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean } }).__city?.ready === true, null, { timeout: 90_000 });
  // Into the parlour through the house's door.
  await page.locator('[data-mark="house"]').click({ timeout: 30_000 });
  await page.locator('[data-thing-chip="house"] [data-act="enter"]').click();
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city?.ready === true, null, { timeout: 90_000 });
  const mark = page.locator('[data-mark="after-service"]');
  await expect(mark).toBeVisible({ timeout: 30_000 });
  // The names every thing shows on a first entry fade before the picture (R-WORLD-005).
  await page.waitForTimeout(2600);
  // A friend of the family visiting stands there too.
  await expect(page.locator('[data-mark="friend-guest"]')).toHaveCount(1);
  await mark.click();
  const chip = page.locator('[data-thing-chip="after-service"]');
  await expect(chip).toContainText("Tobi");
  await expect(chip.locator("[data-person-mark]")).toHaveText("Computer");
  await page.waitForTimeout(400);
  await shoot(page, "m68-1-parlour-tobi", info.project.name);

  await chip.locator('[data-act="talk"]').click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("button", { name: /Start seeing Tobi/ })).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText("After service, by the car park.");
  // The sheet settles before the picture.
  await page.waitForTimeout(800);
  await shoot(page, "m68-2-talk-sheet", info.project.name);
  await card.getByRole("button", { name: /Start seeing Tobi/ }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ command: { type: "people/court", with: TOBI } });
  // Courted, he stands there no more.
  await expect(mark).toHaveCount(0, { timeout: 20_000 });

  await page.locator('[data-thumb="phone"]').click();
  await page.locator('[data-app="chats"]').click();
  await page.locator(`[data-chat-row="${bond}"]`).click();
  const head = page.locator(`[data-bond-head="${bond}"]`);
  await expect(head.locator('[data-head-row="stage"] summary')).toContainText("Seeing each other");
  await expect(head.locator('[data-head-row="ask"]')).toBeVisible();
  await expect(head.locator('[data-head-row="end"]')).toBeVisible();
  // The handset settles before the picture.
  await page.waitForTimeout(800);
  await shoot(page, "m68-3-thread-head", info.project.name);

  await page.locator("[data-chats-back]").click();
  await page.locator('[data-chat-row="people"]').click();
  const slots = page.locator("[data-people-slots]");
  await expect(slots.locator('[data-slot="partner"]')).toBeVisible();
  await expect(slots.locator('[data-slot="mother"]')).toBeVisible();
  await shoot(page, "m68-4-people-slots", info.project.name);
  await page.getByRole("button", { name: "Ask a friend to be your partner" }).click();
  await expect(page.locator("[data-invite-card]")).toContainText("Japacity is a game");
  await page.locator('[data-slot="partner"]').evaluate((element) => element.scrollIntoView({ block: "start" }));
  await shoot(page, "m68-5-invite-card", info.project.name);
});
