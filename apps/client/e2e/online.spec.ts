import type { Command, World } from "@japacity/sim";
import { standInWorld, time } from "@japacity/sim";
import { finishPrologue, start, type Game } from "@japacity/sim/testing";

import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

// The client built against a server is played here against a faked one: every
// /api route is answered by the page's own route handler, in the shapes of
// @japacity/api.
import { content } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { clockAt, fakeServer, ONLINE, SIGNED_OUT, STANDING, viewReply } from "./support/api";
import { SOFTWARE_WEBGL } from "./support/browser";
import { passOpeningWords } from "./support/door";
import { openApp, passCards, passHomeTeach, placeReady } from "./support/live";
import { shootAtSize } from "./support/preview";

// The world's scene needs WebGL, drawn in software where the machine has no GPU (as world.spec.ts draws it).
test.use({ baseURL: ONLINE, launchOptions: SOFTWARE_WEBGL });

const CODE = "4f1e2d3c4b5a69788796a5b4";
const PAIR = "pair-1";
const THEM = "character-them";

const CLOCK = clockAt(3);

/** A fictional business's poster, drawn here so the tile has something to show. */
const POSTER = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#f4c430"/>
  <circle cx="128" cy="118" r="62" fill="#c0392b"/>
  <text x="128" y="126" font-family="Georgia, serif" font-size="30" fill="#fff8e7" text-anchor="middle">Jollof</text>
  <text x="128" y="214" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#2b1d0e" text-anchor="middle">Mama Put Kitchen</text>
</svg>`;

/**
 * The world as an online life opens it, with nothing standing over the place: the chapter's opening words passed, the
 * home's teach card put away (home:moves-carry-cost-and-reason), and the place drawn.
 */
/**
 * `asked`: a guest past its first month with its early win in, asked once to save the life as the world opens
 * (account:guest-secures-the-life); Not now goes on.
 */
async function intoTheWorld(page: Page, asked = false): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("japacity.walkthrough", "1"));
  await page.goto("/");
  await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
  if (asked) {
    const ask = page.getByRole("dialog", { name: "Save this life" });
    await expect(ask).toBeVisible({ timeout: 20_000 });
    await ask.getByRole("button", { name: "Not now" }).click();
    await expect(ask).toHaveCount(0);
  }
  await passOpeningWords(page);
  await placeReady(page);
  await passHomeTeach(page);
  await passCards(page);
}

function friendGame(): Game {
  const game = start({ scenario: "scenario.banker", content });
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

test("[server:signups-off-shows-full] while sign-ups are switched off, a new visitor sees the full screen and no way in", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": SIGNED_OUT,
    "GET /api/age": { status: 503, body: { ok: false, code: "switched-off", detail: "Sign-ups are closed for now.", retryAfter: 30 } },
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Japacity is full right now. Try again shortly." })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Check again" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Day" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await shootAtSize(page, "full", info.project.name);
});

test("[pair:invite-link-single-use] [account:start-screen-over-live-city] an invite link shows the friend's card before sign-up, with its report control, then the age screen, the username with the guest line under it, and the ways back in", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": SIGNED_OUT,
    [`GET /api/invite/${CODE}`]: {
      body: {
        ok: true,
        slot: "partner",
        looking: "partner",
        expires: Date.now() + 14 * time.DAY_MS,
        card: { name: "scenario.banker.name", japacity: { percent: 47, route: "route.uk-masters" }, looking: { key: "card.invite.looking", slot: "partner", fill: "already-in-uk", slotKey: "card.invite.slot.partner", fillKey: "card.invite.fill.already-in-uk" }, game: "card.invite.game", controls: ["block", "report"] },
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
  await shootAtSize(page, "invite", info.project.name);

  await page.getByRole("combobox", { name: "Day" }).selectOption("12");
  await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "March" });
  await page.getByRole("combobox", { name: "Year" }).selectOption("1994");
  // The bot check runs unseen (account:start-screen-over-live-city).
  await expect(page.getByText("Check passed")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  // account:guest-and-secured-states, account:bot-check-on-guest-creation: the card makes the life here, so the username stands under the age screen, the check unseen; a friend who kept a life goes to the ways back in.
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByText("This life lives only on this phone until you save it.")).toHaveCount(1);
  await expect(page.getByText("Check passed")).toHaveCount(0);
  await shootAtSize(page, "invite-username", info.project.name);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await shootAtSize(page, "invite-ways-in", info.project.name);
});

test("[moderation:report-from-every-surface] a friend's conversation carries block and report, and a report offers a block ticked", async ({ page }, info) => {
  const game = friendGame();
  await fakeServer(page, {
    "GET /api/view": { body: viewReply(game, CLOCK.tick) },
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
    "GET /api/moderation/standing": { body: STANDING },
  });
  test.setTimeout(150_000);
  await intoTheWorld(page);
  // The friend's conversation is in the phone's Chats, under the bond's head (world:phone-rises-over-scene).
  const bond = game.view().people.bonds.find((one) => one.pair === PAIR)?.id ?? "";
  const chats = await openApp(page, "chats");
  await chats.locator(`[data-chat-row="${bond}"]`).click();
  const thread = chats.locator(`[data-chat="${PAIR}"]`);
  await expect(thread.locator("[data-thread] li").first()).toBeVisible();
  await expect(thread.locator("[data-thread] li")).toHaveCount(2);
  await expect(thread.locator('[data-moderation="conversation"]').getByRole("button", { name: "Block" })).toBeVisible();
  await expect(chats.locator('[data-moderation="pair"]')).toBeVisible();
  await thread.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await shootAtSize(page, "conversation", info.project.name);

  await thread.locator('[data-moderation="conversation"]').getByRole("button", { name: "Report" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("checkbox", { name: "Block them too" })).toBeChecked();
  await expect(sheet.getByRole("button", { name: "Scam or asking for money" })).toBeVisible();
  await shootAtSize(page, "conversation-report", info.project.name);
});

test("[advert:slots-capped-per-place] the phone tile shows the hour's sponsored tile with the game's own label, and its card can be reported", async ({ page }, info) => {
  const game = start({ scenario: "scenario.banker", content });
  game.grant(1);
  game.endTurn([]);
  await fakeServer(page, {
    "GET /api/view": { body: viewReply(game, CLOCK.tick) },
    "GET /api/account": { body: { ok: true, account: accountView() } },
    "GET /api/adverts": {
      body: {
        ok: true,
        region: "NG",
        hour: 1,
        until: Date.now() + time.HOUR_MS,
        slots: { "advert.phone-tile": { campaign: "campaign-1", creative: "creative-1", version: 1, image: "/api/adverts/image/creative-1/1", width: 256, height: 256, advertiser: "Mama Put Kitchen", text: "Jollof and plantain on the island, open late.", link: null } },
      },
    },
    "GET /api/adverts/image/creative-1/1": { body: POSTER, type: "image/svg+xml" },
    "GET /api/moderation/standing": { body: STANDING },
  });
  test.setTimeout(150_000);
  await intoTheWorld(page);
  // The sponsored tile stands on the phone's home among its tiles (advert:slots-capped-per-place), one at most.
  await page.locator('[data-thumb="phone"]').click();
  const tile = page.locator("[data-phone] [data-advert-slot='advert.phone-tile']");
  await expect(tile).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-phone] [data-advert-slot]")).toHaveCount(1);
  await expect(tile.getByText("Advert")).toBeVisible();
  await shootAtSize(page, "phone-tile", info.project.name);

  await tile.getByRole("button").click();
  const card = page.getByRole("dialog");
  await expect(card).toContainText("Jollof and plantain on the island, open late.");
  await expect(card.locator('[data-moderation="advert"]').getByRole("button", { name: "Report" })).toBeVisible();
  await shootAtSize(page, "advert-card", info.project.name);
});

/** Every phone app on the home screen, in the order it stands. */
async function phoneApps(page: Page): Promise<string[]> {
  return (await page.locator("[data-phone] [data-app]").evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("data-app") ?? ""))).filter((app) => app !== "");
}

/** The requests heard by route, an image's path cut to its route. */
function byRoute(heard: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const asked of heard) {
    const route = asked.replace(/^(GET \/api\/adverts\/image)\/.*$/, "$1").replace(/^(GET \/api\/place)\/.*$/, "$1");
    counts[route] = (counts[route] ?? 0) + 1;
  }
  return counts;
}

test("[server:per-account-rate-limits] [server:public-replies-cached] a guest who opens every phone app in turn, back and forth, for a minute asks nothing more of the hour's adverts, their picture or the account once the phone tile stands", async ({ page }) => {
  const game = start({ scenario: "scenario.banker", content });
  game.grant(1);
  game.endTurn([]);
  const heard: string[] = [];
  await fakeServer(
    page,
    {
      "GET /api/view": { body: viewReply(game, CLOCK.tick) },
      "GET /api/account": { body: { ok: true, account: accountView({ state: "guest" }) } },
      "GET /api/adverts": {
        body: {
          ok: true,
          region: "NG",
          hour: 1,
          until: Date.now() + time.HOUR_MS,
          slots: { "advert.phone-tile": { campaign: "campaign-1", creative: "creative-1", version: 1, image: "/api/adverts/image/creative-1/1", width: 256, height: 256, advertiser: "Mama Put Kitchen", text: "Jollof and plantain on the island, open late.", link: null } },
        },
      },
      "GET /api/adverts/image/creative-1/1": { body: POSTER, type: "image/svg+xml" },
      "GET /api/moderation/standing": { body: STANDING },
    },
    { heard: (asked) => heard.push(asked) },
  );
  test.setTimeout(240_000);
  await intoTheWorld(page, true);
  await page.locator('[data-thumb="phone"]').click();
  const tile = page.locator("[data-phone] [data-advert-slot='advert.phone-tile']");
  await expect(tile).toBeVisible({ timeout: 20_000 });
  const before = heard.length;
  const apps = await phoneApps(page);
  expect(apps.length).toBeGreaterThan(5);
  // A fast human: every app in turn and back to the home screen, over and over, for a minute.
  const until = Date.now() + 60_000;
  let opened = 0;
  while (Date.now() < until) {
    for (const app of apps) {
      await openApp(page, app);
      opened += 1;
      await page.locator("[data-phone-back]").click();
      await expect(tile).toBeVisible();
      if (Date.now() >= until) break;
    }
  }
  const sweep = byRoute(heard.slice(before));
  console.log(`apps opened ${String(opened)}; before the sweep ${JSON.stringify(byRoute(heard.slice(0, before)))}; in the sweep ${JSON.stringify(sweep)}`);
  expect(sweep["GET /api/adverts"] ?? 0).toBe(0);
  // The picture is held once drawn, so it stands with no HTTP cache at all, as here, where the page's requests are routed.
  expect(sweep["GET /api/adverts/image"] ?? 0).toBe(0);
  expect(sweep["GET /api/account"] ?? 0).toBe(0);
  expect(byRoute(heard)["GET /api/adverts"] ?? 0).toBe(1);
});

/** The banker, online, in a world whose Friday draw is on sale: draw 7, closing at tick 14, with nothing sold to the life yet. */
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
  const game = start({ scenario: "scenario.banker", content, worldAt: (tick) => ({ tick, rates: base.rates, vars: base.vars, news: [], era: null, lottery, placeNames: {} }) });
  game.grant(1);
  return game;
}

test.describe("the street kiosk while the world runs the Friday draw", () => {
  test("[lottery:draw-runs-online-only] [world:things-are-tappable-models] [world:one-action-one-sheet] the kiosk on Bode Thomas Street opens the Friday draw's sheet, and one ticket is bought from it in the world", async ({ page }, info) => {
    test.setTimeout(300_000);
    const game = drawGame();
    const sent: Command[] = [];
    await fakeServer(page, {
      "GET /api/view": () => ({ body: viewReply(game, CLOCK.tick) }),
      "POST /api/command": (body) => {
        const { command } = body as { command: Command };
        sent.push(command);
        // The handle bases the command on its own state, as the server does on its stored one.
        const result = game.send(command);
        return result.ok ? { body: { ok: true, view: game.view(), lines: result.lines, clock: CLOCK } } : { status: 409, body: result };
      },
    });
    // The life stands on Bode Thomas Street, where the kiosk is (city:ojuelegba-is-the-hub: the last place stood in opens).
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
    // The kiosk's fan (world:fan-of-sticker-buttons), its button or the small sheet's where the fan has no room.
    await page.locator('[data-mark="kiosk"]').click();
    const act = page.locator('[data-fan="kiosk"] [data-fan-act] button, [data-fan-sheet="kiosk"] [data-fan-act] button').first();
    await expect(act).toBeVisible();
    await act.click();
    const sheet = page.locator('[data-world-sheet="kiosk"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-ask-form]")).toHaveCount(0);
    await expect(sheet).toContainText("The Friday draw");
    await expect(sheet.locator("[data-lottery-close]")).toBeVisible();
    await expect(sheet.locator("[data-lottery-odds]")).toHaveCount(0);

    // Two picked: the button says the act and its price, and under it the balance before, struck, and after (world:one-action-one-sheet,
    // decision 0011).
    await sheet.getByRole("button", { name: "One more ticket" }).click();
    const buy = page.locator("[data-kiosk-buy]");
    await expect(buy).toContainText("Buy 2 tickets");
    const price = 2 * (game.view().lottery?.ticket ?? 0);
    expect(price).toBeGreaterThan(0);
    await expect(buy).toContainText(`₦${Math.round(price / 100).toLocaleString("en-US")}`);
    await expect(page.locator("[data-balance-before]")).toBeVisible();
    await expect(page.locator("[data-balance-after]")).toBeVisible();
    await shootAtSize(page, "kiosk-online", info.project.name);
    // The odds fold behind their row (world:one-action-one-sheet).
    await sheet.locator('[data-kiosk-fold="odds"] button').click();
    await expect(sheet.locator("[data-lottery-odds]")).toBeVisible();
    await sheet.locator('[data-kiosk-fold="odds"]').scrollIntoViewIfNeeded();
    await shootAtSize(page, "kiosk-online-odds", info.project.name);

    // One ticket bought from the kiosk: lottery/buy goes to the server, and the sheet says the ticket is held.
    await sheet.getByRole("button", { name: "One fewer ticket" }).click();
    await expect(buy).toContainText("Buy 1 ticket");
    await buy.click();
    await expect(sheet.locator("[data-lottery-held]")).toHaveAttribute("data-lottery-held", "1");
    expect(sent.filter((command) => command.type === "lottery/buy")).toEqual([expect.objectContaining({ type: "lottery/buy", tickets: 1 })]);
    expect(sent.some((command) => command.type === "activity/now")).toBe(false);
  });
});

test("[world:nobody-picked-from-list] [person:computer-candidates-labelled] [person:courting-opens-a-bond] in the world on a phone, Dele stands in the family house's parlour with the computer mark; his card's button courts him, and his thread in Chats opens with the bond's head", async ({ page }, info) => {
  test.skip(info.project.name !== "Pixel 7", "The world is checked at phone size.");
  test.setTimeout(120_000);
  const DELE = "person.dele-banker";
  const game = start({ scenario: "scenario.banker", content });
  game.grant(1);
  game.endTurn([]);
  const before = { body: viewReply(game, CLOCK.tick) };
  expect(game.view().people.candidates.map((candidate) => candidate.person)).toContain(DELE);
  const result = game.accept({ type: "people/court", with: DELE });
  const after = { ok: true, view: game.view(), lines: result.lines, clock: CLOCK };
  const bond = after.view.people.bonds.find((one) => one.person === DELE)?.id ?? "";
  const sent: unknown[] = [];
  let courted = false;
  await fakeServer(page, {
    "GET /api/view": () => (courted ? { body: after } : before),
    "GET /api/moderation/standing": { body: STANDING },
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
  // The home's teach card, once in a life (home:moves-carry-cost-and-reason), is put away so the parlour is clear.
  const teach = page.locator("[data-home-teach-ok]");
  if (await teach.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) await teach.click();
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean } }).__city?.ready === true, null, { timeout: 90_000 });
  // The family house opens whole, its parlour with it.
  await page.waitForFunction(() => (window as unknown as { __city?: { ready?: boolean; place?: string } }).__city?.ready === true, null, { timeout: 90_000 });
  const mark = page.locator('[data-mark="after-service"]');
  await expect(mark).toBeVisible({ timeout: 30_000 });
  // The names every thing shows on a first entry fade before the picture (world:things-are-tappable-models).
  await page.waitForTimeout(2600);
  // A friend of the family visiting stands there too.
  await expect(page.locator('[data-mark="friend-guest"]')).toHaveCount(1);
  await mark.click();
  // His fan (world:fan-of-sticker-buttons): his name in the pill over him, with the mark's word beside it.
  const chip = page.locator('[data-fan="after-service"]');
  await expect(chip.locator("[data-fan-title]")).toContainText("Dele");
  // The mark's word (person:computer-candidates-labelled).
  await expect(chip.locator("[data-fan-title] [data-person-mark]")).toHaveText("Not a player");
  await page.waitForTimeout(400);
  await shootAtSize(page, "parlour-dele", info.project.name);

  await chip.locator('[data-fan-act="talk"] button').click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("button", { name: /^Ask out/ })).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText("After service, your mother brings him home for lunch.");
  // The sheet settles before the picture.
  await page.waitForTimeout(800);
  await shootAtSize(page, "talk-sheet", info.project.name);
  await card.getByRole("button", { name: /^Ask out/ }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ command: { type: "people/court", with: DELE } });
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
  await shootAtSize(page, "thread-head", info.project.name);

  // The thread's one way back, the app's Back, returns to the chats (world:phone-rises-over-scene).
  await page.locator("[data-phone-back]").click();
  await page.locator('[data-chat-row="people"]').click();
  const slots = page.locator("[data-people-slots]");
  await expect(slots.locator('[data-slot="partner"]')).toBeVisible();
  await expect(slots.locator('[data-slot="mother"]')).toBeVisible();
  await shootAtSize(page, "people-slots", info.project.name);
  await page.getByRole("button", { name: "Ask a friend to be your partner" }).click();
  await expect(page.locator("[data-invite-card]")).toContainText("Japacity is a game");
  await page.locator('[data-slot="partner"]').evaluate((element) => element.scrollIntoView({ block: "start" }));
  await shootAtSize(page, "invite-card", info.project.name);
});

test("[world:lazy-part-fails-softly] [city:places-load-on-entry] a reload into a new life whose place's scene fails to load once, as a fetch a reload or a dropped connection cut, fetches it again by itself and draws the place with no connection card", async ({ page }) => {
  test.setTimeout(150_000);
  const game = start({ scenario: "scenario.prologue", content });
  finishPrologue(game);
  await fakeServer(page, { "GET /api/view": { body: viewReply(game, CLOCK.tick) }, "GET /api/moderation/standing": { body: STANDING } });
  // Any card that shows, even for a moment, is kept on the window.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector("[data-trouble]") !== null) (window as unknown as { troubleSeen?: boolean }).troubleSeen = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await intoTheWorld(page);

  // The scene's code is cut once, on the first fetch after the reload.
  let cut = 0;
  await page.route(/CityScene/, async (route) => {
    if (cut > 0) return route.fallback();
    cut += 1;
    return route.abort("connectionreset");
  });
  await page.reload();
  await placeReady(page);
  expect(cut).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { troubleSeen?: boolean }).troubleSeen ?? false)).toBe(false);
  await expect(page.locator("[data-trouble]")).toHaveCount(0);
});
