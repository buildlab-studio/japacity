import { start } from "@japacity/sim/testing";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// The guest start and keeping a guest life (docs/rules/account.md R-ACCOUNT-021
// to 027), played against a faked server as online.spec.ts does: every /api
// route is answered here, in the shapes of @japacity/api.
import { content, uiOnlineText, uiText } from "../../../packages/content/src/index";

const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;
test.use({ baseURL: ONLINE });

const PREVIEW = process.env.PREVIEW_DIR;

/** R-ACCOUNT pictures are phone pictures, taken on the Pixel projects only. */
async function shoot(page: Page, name: string, project: string): Promise<void> {
  if (PREVIEW === undefined || PREVIEW === "" || !project.startsWith("Pixel")) return;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(PREVIEW, `${name}-phone.png`), fullPage: false });
}

type Answer = { status?: number; body: unknown };

const SIGNED_OUT: Answer = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
const NO_CHARACTER: Answer = { status: 404, body: { ok: false, code: "no-character", detail: "No character yet." } };
const CLOCK = { tick: 3, nextTickAt: Date.now() + 3_600_000, nextTurnAt: null };
const GUEST = { id: "account-guest", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state: "guest", username: "ada_lagos", renameFrom: 0, ways: { google: null, email: null, passkeys: 0 } };
/** The same life once kept with Google: Google's address is the code's address too (GET /api/account's ways). */
const KEPT_WITH_GOOGLE = { ...GUEST, state: "secured", ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 0 } };
const STANDING = { body: { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } } };

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

/** Answers every /api route from `answers`, read at each request so a test can change an answer as the server's state moves. */
async function fakeServer(page: Page, answers: Record<string, Answer>, sent: string[] = []): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const key = `${request.method()} ${new URL(request.url()).pathname}`;
      sent.push(key);
      const answer = answers[key];
      if (answer === undefined) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, code: "unknown-id", detail: "not faked" }) });
      return route.fulfill({ status: answer.status ?? 200, contentType: "application/json", body: JSON.stringify(answer.body) });
    },
  );
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: TURNSTILE }));
}

/**
 * The second chapter's mission card opens over the world as it loads, handed by its person (design page 13 section 4);
 * the asks wait until its Let's go is pressed (R-ACCOUNT-023).
 */
async function pastTheCard(page: Page): Promise<void> {
  const card = page.locator("[data-brief='chapter.build-the-file']");
  await expect(card).toBeVisible({ timeout: 20_000 });
  // The keep-this-life ask never stands over the card (R-ACCOUNT-023: never over a moment or another card that is up).
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Keep this life" })).toHaveCount(0);
  await card.getByRole("button", { name: "Let's go" }).click();
  await expect(card).toHaveCount(0);
}

/** A guest's life past its first chapter, so the early win is in and the first ask is due. */
function pastFirstChapter(): Answer {
  const game = start({ scenario: "scenario.tunde", content });
  game.grant(1);
  const view = game.view();
  // The file's own items, none met yet: the first chapter's items under the file's id would name steps it does not have.
  const items = (content.chapter["chapter.build-the-file"]?.items ?? []).map((item) => ({ id: item.id, met: false }));
  return { body: { ok: true, view: { ...view, chapter: { ...view.chapter, done: ["chapter.find-your-feet"], current: "chapter.build-the-file", items } }, lines: [], clock: CLOCK } };
}

test("[R-ACCOUNT-021] [R-ACCOUNT-024] [R-GUIDE-015] a new visitor passes the age screen and changes the username on the door's page; Begin starts the guest with it, and no sign-in method is asked at the door", async ({ page }, info) => {
  const sent: string[] = [];
  const bodies: unknown[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": SIGNED_OUT,
    "GET /api/age": { body: { refused: false } },
    "POST /api/age": { body: { ok: true } },
    "POST /api/guest": { body: { ok: true, account: GUEST } },
    "POST /api/character": NO_CHARACTER,
    "GET /api/account": { body: { ok: true, account: GUEST } },
  };
  await fakeServer(page, answers, sent);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/guest") bodies.push(request.postDataJSON());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click({ timeout: 20_000 });
  await page.getByRole("combobox", { name: "Day" }).selectOption("17");
  await page.getByRole("combobox", { name: "Month" }).selectOption({ label: "May" });
  await page.getByRole("combobox", { name: "Year" }).selectOption("1990");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Next/ }).first().click({ timeout: 20_000 });
  await page.locator("[data-gate='life']").getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  const username = page.getByLabel("Username");
  await expect(username).not.toHaveValue("");
  await username.fill("ada_lagos");
  await shoot(page, "username", info.project.name);
  await page.getByRole("button", { name: /^Begin/ }).click();
  await expect.poll(() => sent.includes("POST /api/character")).toBe(true);
  expect(bodies).toEqual([{ username: "ada_lagos" }]);
  expect(sent.some((route) => route.includes("/api/auth/"))).toBe(false);
});

test("[R-ACCOUNT-023] [R-ACCOUNT-027] a guest past its first chapter is asked once to keep the life, and the month's line stays after", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": STANDING,
  });
  await page.goto("/");
  await pastTheCard(page);
  const ask = page.getByRole("dialog", { name: "Keep this life" });
  await expect(ask).toBeVisible({ timeout: 20_000 });
  // Read through the words table, so the line the sheet says is the one the test looks for.
  await expect(ask.getByText(uiOnlineText["ui.secure.ask.first-chapter"] ?? "ui.secure.ask.first-chapter")).toBeVisible();
  // Google's own button, in one of Google's texts (R-ACCOUNT-023).
  await expect(ask.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await shoot(page, "first-chapter-ask", info.project.name);
  await ask.getByRole("button", { name: "Not now" }).click();
  await expect(ask).toHaveCount(0);
});

test.describe("inside a messaging app's browser", () => {
  test.use({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1" });

  test("[R-ACCOUNT-023] the securing sheet offers the emailed code and the way out to the browser, and no Google", async ({ page }, info) => {
    const view = pastFirstChapter();
    await fakeServer(page, {
      "GET /api/view": view,
      "GET /api/account": { body: { ok: true, account: GUEST } },
      "GET /api/moderation/standing": STANDING,
    });
    await page.goto("/");
    await pastTheCard(page);
    const sheet = page.getByRole("dialog", { name: "Keep this life" });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(sheet.getByText("Google sign-in does not work inside this app.", { exact: false })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Open in your browser" })).toHaveAttribute("href", /^intent:\/\//);
    await sheet.getByLabel("Email").fill("ada@example.com");
    await shoot(page, "securing-sheet-in-app", info.project.name);
  });
});

test("[R-ACCOUNT-023] a guest secures the life later by a code sent to an email, from the ask after the first chapter, and the same life goes on", async ({ page }) => {
  const sent: string[] = [];
  const view = pastFirstChapter();
  const answers: Record<string, Answer> = {
    "GET /api/view": view,
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": STANDING,
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    "POST /api/auth/sign-in/email-otp": { body: { token: "session-2", user: { id: GUEST.id, email: "ada@example.com", emailVerified: true, name: "", createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" } } },
  };
  await fakeServer(page, answers, sent);
  await page.goto("/");
  await pastTheCard(page);
  const sheet = page.getByRole("dialog", { name: "Keep this life" });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.getByLabel("Email").fill("ada@example.com");
  await sheet.getByRole("button", { name: "Send me a code" }).click();
  answers["GET /api/account"] = { body: { ok: true, account: { ...GUEST, state: "secured" } } };
  await sheet.getByLabel("The 6-digit code").fill("123456");
  await sheet.getByRole("button", { name: "Keep my life" }).click();
  await expect(page.getByText("Done. This life is yours on any phone now.")).toBeVisible();
  // Kept, the sheet says only that.
  const kept = page.getByRole("dialog", { name: "Kept" });
  await expect(kept).toBeVisible();
  await expect(kept.getByRole("button", { name: "Not now" })).toHaveCount(0);
  await expect(kept.getByLabel("Email")).toHaveCount(0);
  expect(sent).toContain("POST /api/auth/sign-in/email-otp");
  // The life goes on as it was: no new character was asked for.
  expect(sent).not.toContain("POST /api/character");
});

test("[R-ACCOUNT-023] a guest that comes back from Google with the life kept sees the keeping sheet in its kept state, the address left clean, and the world says Kept with Google as it closes", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: KEPT_WITH_GOOGLE } },
    "GET /api/moderation/standing": STANDING,
  });
  // Where the library's callback sends the page once Google kept the life (shared/net/auth.ts, GOOGLE_BACK).
  await page.goto("/?google=kept");
  const kept = page.getByRole("dialog", { name: "Kept" });
  await expect(kept).toBeVisible({ timeout: 20_000 });
  await expect(kept.getByText("Done. This life is yours on any phone now.")).toBeVisible();
  await expect(kept.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
  await shoot(page, "kept-with-google", info.project.name);
  await kept.getByRole("button", { name: uiText["ui.report.close"] ?? "Close" }).click();
  await expect(page.locator("[data-way-toast]")).toHaveText("Kept with Google");
});

test("[R-ACCOUNT-021] [R-ACCOUNT-027] a kept life names its way in on Settings' account row; signing out says so once on the start screen, and the notice goes when I already have a life here is tapped", async ({ page }, info) => {
  const sent: string[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: KEPT_WITH_GOOGLE } },
    "GET /api/moderation/standing": STANDING,
    "POST /api/auth/sign-out": { body: { success: true } },
    "GET /api/age": { body: { refused: false } },
  };
  await fakeServer(page, answers, sent);
  await page.goto("/");
  await pastTheCard(page);
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator('[data-app="settings"]').click();
  const row = page.locator("[data-account-row]");
  await expect(row).toContainText("@ada_lagos");
  await expect(row).toContainText("Kept with Google as ada@example.com");
  await shoot(page, "settings-account-row", info.project.name);
  await row.click();
  const sheet = page.getByRole("dialog", { name: uiOnlineText["ui.account.settings"] ?? "Account" });
  await expect(sheet.getByText("Kept with Google as ada@example.com")).toBeVisible();
  await expect(sheet.getByText("Passkey: none yet")).toBeVisible();
  await shoot(page, "settings-account-sheet", info.project.name);
  answers["GET /api/view"] = SIGNED_OUT;
  answers["GET /api/account"] = SIGNED_OUT;
  await sheet.getByRole("button", { name: "Sign out" }).click();
  const notice = page.getByText(uiOnlineText["ui.account.notice.signed-out"] ?? "You have signed out.");
  await expect(notice).toBeVisible({ timeout: 20_000 });
  expect(sent).toContain("POST /api/auth/sign-out");
  await page.getByRole("button", { name: "I already have a life here" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(notice).toHaveCount(0);
  await page.getByRole("button", { name: uiOnlineText["ui.account.back"] ?? "Back" }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
});
