import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { devices, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// The online game end to end on the local stack (server.md R-SERVER-038): the client as the local
// Worker serves it, Postgres and Mailpit in Docker Compose, Turnstile's always-pass test keys, and
// nothing faked. One new player is played through the tests in order, on a Pixel 7: the way in, a
// life started and a month ended, the life kept with an email code, the Friday draw bought at the
// kiosk, the Credits, sign out and back in, and the invite link's page. Each test fails on any
// console error, any failed request and any refusal it did not ask for. With --staging (REAL_BASE_URL)
// the same tests run against staging behind Access; those that need Mailpit or the local database are skipped.
import { realTarget, withAccess } from "../../../../tools/local/access";
import { cronUrl, readLocalStack } from "../../../../tools/local/env";
import { passOpeningWords, passThePage } from "../support/door";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const stack = readLocalStack(ROOT);
const target = realTarget(process.env, stack.siteUrl);
const NO_MAILPIT = "staging has no Mailpit, so no email code can be read there";
const NO_LOCAL_DATABASE = "the switch is set on the local database, which staging is not";
const SHOTS = process.env.PREVIEW_DIR ?? "";
/** A new address each run: the code sends are limited per address a day (R-ACCOUNT-014). */
const EMAIL = `player-${String(Date.now())}@example.com`;
const USERNAME = `real_${String(Date.now()).slice(-9)}`;

async function shoot(page: Page, name: string): Promise<void> {
  if (SHOTS === "") return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

/** What went wrong in the page: console errors, page errors, failed requests and refusals not on the allowed list ("401 GET /api/view"). */
interface Watch {
  problems: () => string[];
  allow: (...answers: string[]) => void;
  reset: () => void;
}

function watch(page: Page): Watch {
  let seen: string[] = [];
  let allowed = new Set<string>();
  const refused = new Set<string>();
  const answer = (status: number, method: string, url: string) => `${String(status)} ${method} ${new URL(url).pathname}`;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const from = message.location().url;
    // The bot check's own widget logs to the console from Cloudflare's origin; that is not the game's doing.
    if (from.startsWith("https://challenges.cloudflare.com/")) return;
    // The browser logs every 4xx as an error; an allowed refusal's line is not a problem.
    if (message.text().startsWith("Failed to load resource") && from !== "" && [...refused].some((one) => one.endsWith(` ${new URL(from).pathname}`))) return;
    seen.push(`console: ${message.text()} (${from})`);
  });
  page.on("pageerror", (error) => seen.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    // A navigation away cancels what the page was still loading; that is the page's own doing.
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    seen.push(`failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    // Cloudflare's own paths (the bot check's challenge platform) answer for themselves, not for the game.
    if (response.status() < 400 || new URL(response.url()).pathname.startsWith("/cdn-cgi/")) return;
    const said = answer(response.status(), response.request().method(), response.url());
    if (allowed.has(said)) refused.add(said);
    else seen.push(`refused: ${said}`);
  });
  return {
    problems: () => seen,
    allow: (...answers) => {
      allowed = new Set([...allowed, ...answers]);
    },
    reset: () => {
      seen = [];
      allowed = new Set();
      refused.clear();
    },
  };
}

/** A Pixel 7 of its own: cookies and storage apart from every other phone. */
async function newPhone(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL: target.baseUrl, ignoreHTTPSErrors: target.local });
  await withAccess(context, process.env, target.baseUrl);
  return context;
}

/** The newest code Mailpit holds for the address, read from its API (GET /api/v1/messages). */
async function codeFor(page: Page, email: string, after: number): Promise<string> {
  let found = "";
  await expect
    .poll(
      async () => {
        const reply = await page.request.get(`${stack.mailpitUrl}/api/v1/messages`);
        const { messages } = (await reply.json()) as { messages: { To: { Address: string }[]; Subject: string; Snippet: string; Created: string }[] };
        const mine = messages.find((one) => one.To.some((to) => to.Address === email) && Date.parse(one.Created) >= after);
        found = mine?.Snippet.match(/\b(\d{6})\b/)?.[1] ?? "";
        if (mine !== undefined) expect(mine.Subject).toBe("Your Japacity code");
        return found;
      },
      { timeout: 20_000, message: `no code reached Mailpit for ${email}` },
    )
    .not.toBe("");
  return found;
}

/** Sets a switch on the local database through the store, as tools/local/switch.ts does for a person. */
function setSwitch(name: string, on: boolean): void {
  execFileSync("pnpm", ["exec", "tsx", "tools/local/switch.ts", name, on ? "on" : "off"], { cwd: ROOT, stdio: "ignore" });
}

/** The phone, then one of its apps. */
async function openApp(page: Page, app: string): Promise<void> {
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator(`[data-app="${app}"]`).click();
}

async function closePhone(page: Page): Promise<void> {
  const home = page.locator("[data-home-bar]");
  if (await home.isVisible().catch(() => false)) await home.click();
  await page.keyboard.press("Escape");
}

/** Staging's managed bot check refuses an automated browser (R-SERVER-038, R-ACCOUNT-013): true once it did, and the life's later tests do not run. */
let stoppedAtTheCheck = false;
const STOPPED = "Staging's bot check refused the automated browser at Begin, by design: the rest of the life is played on the local stack, or on staging by a person.";

test.describe("one new player, played in order on one phone", () => {
  test.describe.configure({ mode: "serial" });

  let phone: BrowserContext;
  let page: Page;
  let seen: Watch;

  test.beforeAll(async ({ browser }) => {
    phone = await newPhone(browser);
    page = await phone.newPage();
    seen = watch(page);
  });

  test.afterAll(async () => {
    await phone.close();
  });

  test.beforeEach(() => {
    test.skip(stoppedAtTheCheck, STOPPED);
    seen.reset();
  });

  test("[R-SERVER-038] [R-ACCOUNT-029] [R-ACCOUNT-012] a new visitor sees the game's own way in as the server serves it: the start screen, then the age screen", async () => {
    // Signed out, the client asks who is there and is told nobody yet.
    seen.allow("401 GET /api/view", "401 GET /api/account");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 60_000 });
    await shoot(page, "real-01-start");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Day" })).toBeVisible();
    await shoot(page, "real-02-age");
    expect(seen.problems()).toEqual([]);
  });

  test("[R-ACCOUNT-021] [R-SERVER-001] a life started online: the age answered, the door passed, Begin makes the guest and its character on the server, and one month is ended through /api/command", async () => {
    seen.allow("401 GET /api/view", "401 GET /api/account");
    await page.getByRole("combobox", { name: "Day" }).selectOption("17");
    await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "May" });
    await page.getByRole("combobox", { name: "Year" }).selectOption("1990");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 30_000 });
    await page.getByRole("radio", { name: "The nurse", exact: true }).click({ timeout: 30_000 });
    await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
    await page.getByLabel("Username").fill(USERNAME);
    const guest = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/guest");
    // Staging's bot check may refuse this browser (below); locally the status is still checked.
    if (!target.local) seen.allow("403 POST /api/guest");
    await page.getByRole("button", { name: /^Begin/ }).click();
    const started = await guest;
    if (!target.local && started.status() === 403 && (await started.text()).includes('"bot-check"')) {
      // The game says so on the page, in its own words, and the life goes no further here.
      await expect(page.getByRole("alert")).toContainText("The quick check did not go through.");
      await shoot(page, "real-03-bot-check");
      expect(seen.problems()).toEqual([]);
      stoppedAtTheCheck = true;
      test.skip(true, STOPPED);
    }
    expect(started.status(), `the guest start was refused: ${await started.text()}`).toBe(200);
    await passThePage(page, 60_000);
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await passOpeningWords(page, 20_000);
    await shoot(page, "real-03-world");

    // The month is ended on the server: the band's Next month, through the Calendar where it opens first.
    const ended = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/command" && (response.request().postData() ?? "").includes('"turn/end"'), { timeout: 60_000 });
    const end = page.locator("[data-end-month]").first();
    await expect(end).toBeEnabled({ timeout: 30_000 });
    await end.click();
    const calendar = page.locator("[data-app-screen='calendar']");
    if (await calendar.waitFor({ state: "visible", timeout: 3_000 }).then(() => true, () => false)) await calendar.locator("[data-month-end]").click();
    const reply = await ended;
    expect(reply.status(), await reply.text()).toBe(200);
    expect(((await reply.json()) as { ok: boolean }).ok).toBe(true);
    await expect(page.locator("[data-world-sheet='results']")).toBeVisible({ timeout: 60_000 });
    await shoot(page, "real-04-month-ended");
    await page.keyboard.press("Escape");
    expect(seen.problems()).toEqual([]);
  });

  test("[R-ACCOUNT-023] [R-ACCOUNT-014] the guest keeps the life by a code sent to an email: the code is read from Mailpit's inbox, and the same life goes on", async () => {
    test.skip(!target.local, NO_MAILPIT);
    await openApp(page, "settings");
    await page.locator("[data-account-row]").click();
    await page.locator("[data-guest-reminder]").getByRole("button").click();
    const sheet = page.getByRole("dialog", { name: "Keep this life" });
    await expect(sheet).toBeVisible();
    const asked = Date.now() - 1_000;
    await sheet.getByLabel("Email").fill(EMAIL);
    await sheet.getByRole("button", { name: "Send me a code" }).click();
    const code = await codeFor(page, EMAIL, asked);
    await sheet.getByLabel("The 6-digit code").fill(code);
    await shoot(page, "real-05-keep-code");
    await sheet.getByRole("button", { name: "Keep my life" }).click();
    await expect(page.getByText("Done. This life is yours on any phone now.")).toBeVisible({ timeout: 20_000 });
    const account = await page.request.get("/api/account");
    expect(((await account.json()) as { account: { state: string; username: string } }).account).toMatchObject({ state: "secured", username: USERNAME });
    await page.keyboard.press("Escape");
    expect(seen.problems()).toEqual([]);
  });

  test("[R-LOTTERY-001] [R-WORLD-006] the kiosk on Bode Thomas Street sells a ticket for the world's Friday draw, bought through /api/command", async () => {
    test.skip(!target.local, `a ticket needs the life kept by an email code, and ${NO_MAILPIT}`);
    // The world's five-minute job keeps the draw on sale (R-CLOCK-012); it is run once more here.
    const cron = await page.request.post(cronUrl(stack), { data: { cron: "*/5 * * * *" } });
    expect(cron.ok()).toBe(true);
    await page.evaluate(() => {
      localStorage.setItem("japacity.city.last", JSON.stringify(["place.bode-thomas"]));
    });
    await page.reload();
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(() => {
      const city = (window as unknown as { __city?: { place: string; ready: boolean } }).__city;
      return city !== undefined && city.ready && city.place === "place.bode-thomas";
    }, null, { timeout: 120_000 });
    await passOpeningWords(page);
    const teach = page.locator("[data-home-teach-ok]");
    if (await teach.isVisible().catch(() => false)) await teach.click();
    // The kiosk's fan, and its act (R-WORLD-034).
    await page.locator('[data-mark="kiosk"]').click();
    await page.locator('[data-fan="kiosk"] [data-fan-act] button, [data-fan-sheet="kiosk"] [data-fan-act] button').first().click();
    const sheet = page.locator('[data-world-sheet="kiosk"]');
    await expect(sheet).toContainText("The Friday draw", { timeout: 30_000 });
    const bought = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/command" && (response.request().postData() ?? "").includes('"lottery/buy"'));
    await page.locator("[data-kiosk-buy]").click();
    const reply = await bought;
    expect(reply.status(), await reply.text()).toBe(200);
    await expect(sheet.locator("[data-lottery-held]")).toHaveAttribute("data-lottery-held", "1");
    await shoot(page, "real-06-kiosk");
    await page.keyboard.press("Escape");
    expect(seen.problems()).toEqual([]);
  });

  test("[R-CITY-021] the Credits open from the phone's Settings, with the map data linked", async () => {
    await openApp(page, "settings");
    const row = page.locator("[data-credits-row]");
    await row.scrollIntoViewIfNeeded();
    await row.click();
    const sheet = page.getByRole("dialog", { name: "Credits" });
    await expect(sheet.getByRole("link", { name: "OpenStreetMap" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    await shoot(page, "real-07-credits");
    await page.keyboard.press("Escape");
    await closePhone(page);
    expect(seen.problems()).toEqual([]);
  });

  test("[R-ACCOUNT-001] [R-ACCOUNT-002] the player signs out, then signs in again by a code from Mailpit, and the same life opens", async () => {
    test.skip(!target.local, NO_MAILPIT);
    await openApp(page, "settings");
    await page.locator("[data-account-row]").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    // Signed out, the client asks again who is there.
    seen.allow("401 GET /api/view", "401 GET /api/account");
    await page.getByRole("button", { name: "I already have a life here" }).click({ timeout: 30_000 });
    const asked = Date.now() - 1_000;
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByRole("button", { name: "Send me a code" }).click();
    const code = await codeFor(page, EMAIL, asked);
    await page.getByLabel("The 6-digit code").fill(code);
    await shoot(page, "real-08-sign-in");
    await page.getByRole("button", { name: /^Sign in/ }).click();
    await expect(page.locator("[data-band]")).toBeVisible({ timeout: 60_000 });
    const account = await page.request.get("/api/account");
    expect(((await account.json()) as { account: { username: string } }).account.username).toBe(USERNAME);
    await shoot(page, "real-09-back-in");
    expect(seen.problems()).toEqual([]);
  });

  test("[R-PAIR-007] [R-PAIR-008] the invite link's page: a card made for the partner slot opens for a friend on another phone, before sign-up, with the age screen under it", async ({ browser }) => {
    test.skip(!target.local, `an invite needs the life kept by an email code, and ${NO_MAILPIT}`);
    await openApp(page, "chats");
    await page.locator('[data-chat-row="people"]').click();
    await page.getByRole("button", { name: "Ask a friend to be your partner" }).click();
    const made = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/command" && (response.request().postData() ?? "").includes('"people/invite"'));
    await page.getByRole("form", { name: "Ask a friend" }).locator('button[type="submit"]').click();
    expect((await made).status()).toBe(200);
    // The link's button waits for the early win (R-GUIDE-015); the same route it calls gives the code.
    const invite = await page.request.post("/api/invite", { data: { slot: "partner" }, headers: { origin: target.baseUrl } });
    expect(invite.status(), await invite.text()).toBe(200);
    const { code } = (await invite.json()) as { code: string };

    const friend = await newPhone(browser);
    try {
      const theirs = await friend.newPage();
      const theirWatch = watch(theirs);
      theirWatch.allow("401 GET /api/view", "401 GET /api/account");
      await theirs.goto(`/invite/${code}`);
      const card = theirs.locator("[data-invite-card]");
      await expect(card).toContainText("Japacity is a game", { timeout: 60_000 });
      await expect(theirs.getByRole("combobox", { name: "Day" })).toBeVisible();
      await shoot(theirs, "real-10-invite");
      expect(theirWatch.problems()).toEqual([]);
    } finally {
      await friend.close();
    }
    expect(seen.problems()).toEqual([]);
  });

});

test("[R-SERVER-031] [R-SERVER-032] with sign-ups switched off in the database, a new visitor sees the full screen and no way in; switched on again, the way in is back", async ({ browser }) => {
  test.skip(!target.local, NO_LOCAL_DATABASE);
  test.setTimeout(240_000);
  const visitor = await newPhone(browser);
  try {
    setSwitch("signups", false);
    const theirs = await visitor.newPage();
    const theirWatch = watch(theirs);
    theirWatch.allow("401 GET /api/view", "401 GET /api/account", "503 GET /api/age");
    // The Worker keeps the switch row for up to `switches.cacheMs`, so the screen may take that long to change.
    await expect(async () => {
      await theirs.goto("/");
      await expect(theirs.getByRole("heading", { name: "Japacity is full right now. Try again shortly." })).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 90_000, intervals: [5_000] });
    await expect(theirs.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
    await shoot(theirs, "real-11-full");
    expect(theirWatch.problems()).toEqual([]);
  } finally {
    setSwitch("signups", true);
    await visitor.close();
  }
});
