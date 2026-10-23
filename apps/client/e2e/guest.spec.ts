import { start } from "@japacity/sim/testing";

import { expect, test, type Page } from "@playwright/test";

// The guest start and keeping a guest life (account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:username-and-unconfirmed-email, account:guest-floods-are-capped, account:idle-guests-cleaned-by-hand and account:guest-reminded-to-secure), played against a faked server as online.spec.ts does: every /api
// route is answered here, in the shapes of @japacity/api.
import { content, uiOnlineText, uiText } from "../../../packages/content/src/index";
import { accountView } from "../src/shared/testing/fixtures";
import { type Answer, clockAt, fakeServer, NO_CHARACTER, ONLINE, SIGNED_OUT, STANDING } from "./support/api";
import { shootPhone } from "./support/preview";

test.use({ baseURL: ONLINE });

/** The account pictures are phone pictures, taken on the Pixel projects only, at 390 by 844. */
const PICTURE = { width: 390, height: 844 };

const CLOCK = clockAt(3);
const GUEST = accountView({ id: "account-guest", state: "guest" });
/** The same life once kept with Google: Google's address is the code's address too (GET /api/account's ways). */
const KEPT_WITH_GOOGLE = { ...GUEST, state: "secured", ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 0 } };

/** The faked server, every request kept in `sent`; the bot check's box drawn whatever it is asked. */
async function serve(page: Page, answers: Record<string, Answer>, sent: string[] = []): Promise<void> {
  await fakeServer(page, answers, { heard: (asked) => sent.push(asked), check: { drawn: true } });
}

/**
 * The second chapter's mission card opens over the world as it loads, handed by its person (design page 09 section 4);
 * the asks wait until its Let's go is pressed (account:guest-secures-the-life).
 */
async function pastTheCard(page: Page): Promise<void> {
  const card = page.locator("[data-brief='chapter.build-the-file']");
  await expect(card).toBeVisible({ timeout: 20_000 });
  // The keep-this-life ask never stands over the card (account:guest-secures-the-life: never over a moment or another card that is up).
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: "Save this life" })).toHaveCount(0);
  await card.getByRole("button", { name: "Let's go" }).click();
  await expect(card).toHaveCount(0);
}

/** A guest's life past its first chapter, so the early win is in and the first ask is due. */
function pastFirstChapter(): Answer {
  const game = start({ scenario: "scenario.banker", content });
  game.grant(1);
  const view = game.view();
  // The file's own items, none met yet: the first chapter's items under the file's id would name steps it does not have.
  const items = (content.chapter["chapter.build-the-file"]?.items ?? []).map((item) => ({ id: item.id, met: false }));
  return { body: { ok: true, view: { ...view, chapter: { ...view.chapter, done: ["chapter.find-your-feet"], current: "chapter.build-the-file", items } }, lines: [], clock: CLOCK } };
}

test("[account:guest-and-secured-states] [account:username-and-unconfirmed-email] [account:username-typed-and-checked] [guide:nothing-asked-before-early-win] a new visitor passes the age screen and types a username into the empty box on the door's page; Begin starts the guest with it, and no sign-in method is asked at the door", async ({ page }, info) => {
  const sent: string[] = [];
  const bodies: unknown[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": SIGNED_OUT,
    "GET /api/age": { body: { refused: false } },
    "POST /api/age": { body: { ok: true } },
    "GET /api/username/available": { body: { ok: true, free: true } },
    "POST /api/guest": { body: { ok: true, account: GUEST } },
    "POST /api/character": { status: 404, body: NO_CHARACTER },
    "GET /api/account": { body: { ok: true, account: GUEST } },
  };
  await serve(page, answers, sent);
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
  // account:username-typed-and-checked: the box starts empty; the player types their own and hears it is free.
  await expect(username).toHaveValue("");
  await username.fill("ada_lagos");
  await expect(page.getByText("That name is free.")).toBeVisible();
  await shootPhone(page, "username-phone", info.project.name, PICTURE);
  await page.getByRole("button", { name: /^Begin/ }).click();
  await expect.poll(() => sent.includes("POST /api/character")).toBe(true);
  expect(bodies).toEqual([{ username: "ada_lagos" }]);
  expect(sent.some((route) => route.includes("/api/auth/"))).toBe(false);
});

test("[account:guest-secures-the-life] [account:guest-reminded-to-secure] a guest past its first chapter is asked once to keep the life, and the month's line stays after", async ({ page }, info) => {
  await serve(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": { body: STANDING },
  });
  await page.goto("/");
  await pastTheCard(page);
  const ask = page.getByRole("dialog", { name: "Save this life" });
  await expect(ask).toBeVisible({ timeout: 20_000 });
  // Read through the words table, so the line the sheet says is the one the test looks for.
  await expect(ask.getByText(uiOnlineText["ui.secure.ask.first-chapter"] ?? "ui.secure.ask.first-chapter")).toBeVisible();
  // Google's own button, in one of Google's texts (account:guest-secures-the-life).
  await expect(ask.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await shootPhone(page, "first-chapter-ask-phone", info.project.name, PICTURE);
  await ask.getByRole("button", { name: "Not now" }).click();
  await expect(ask).toHaveCount(0);
});

test.describe("inside a messaging app's browser", () => {
  test.use({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1" });

  test("[account:guest-secures-the-life] the securing sheet offers the emailed code alone, with no Google and no way out before the life is kept", async ({ page }, info) => {
    const view = pastFirstChapter();
    await serve(page, {
      "GET /api/view": view,
      "GET /api/account": { body: { ok: true, account: GUEST } },
      "GET /api/moderation/standing": { body: STANDING },
    });
    await page.goto("/");
    await pastTheCard(page);
    const sheet = page.getByRole("dialog", { name: "Save this life" });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    await expect(sheet.getByText("Google does not open inside this app. Save this life with your email here, then open it in any browser.")).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Open in my browser" })).toHaveCount(0);
    await sheet.getByLabel("Email").fill("ada@example.com");
    await shootPhone(page, "securing-sheet-in-app-phone", info.project.name, PICTURE);
  });
});

test("[account:guest-secures-the-life] [account:code-form-forgives] a guest secures the life later by a code sent to an email, from the ask after the first chapter, and the same life goes on", async ({ page }) => {
  const sent: string[] = [];
  const view = pastFirstChapter();
  const answers: Record<string, Answer> = {
    "GET /api/view": view,
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": { body: STANDING },
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    "POST /api/auth/sign-in/email-otp": { body: { token: "session-2", user: { id: GUEST.id, email: "ada@example.com", emailVerified: true, name: "", createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" } } },
  };
  await serve(page, answers, sent);
  await page.goto("/");
  await pastTheCard(page);
  const sheet = page.getByRole("dialog", { name: "Save this life" });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.getByLabel("Email").fill("ada@example.com");
  await sheet.getByRole("button", { name: "Send me a code" }).click();
  answers["GET /api/account"] = { body: { ok: true, account: { ...GUEST, state: "secured" } } };
  // The sixth digit sends the code (account:code-form-forgives).
  await sheet.getByLabel("The 6-digit code").fill("123456");
  await expect(page.getByText("Saved. Sign in on any phone to carry on.")).toBeVisible();
  // Saved, the sheet says only that.
  const kept = page.getByRole("dialog", { name: "Saved" });
  await expect(kept).toBeVisible();
  await expect(kept.getByRole("button", { name: "Not now" })).toHaveCount(0);
  await expect(kept.getByLabel("Email")).toHaveCount(0);
  expect(sent).toContain("POST /api/auth/sign-in/email-otp");
  // The life goes on as it was: no new character was asked for.
  expect(sent).not.toContain("POST /api/character");
});

test("[account:guest-secures-the-life] a guest that comes back from Google with the life kept sees the keeping sheet in its kept state, the address left clean, and the world says Saved with Google as it closes", async ({ page }, info) => {
  await serve(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: KEPT_WITH_GOOGLE } },
    "GET /api/moderation/standing": { body: STANDING },
  });
  // Where the library's callback sends the page once Google kept the life (shared/net/auth.ts, GOOGLE_BACK).
  await page.goto("/?google=kept");
  const kept = page.getByRole("dialog", { name: "Saved" });
  await expect(kept).toBeVisible({ timeout: 20_000 });
  await expect(kept.getByText("Saved. Sign in on any phone to carry on.")).toBeVisible();
  await expect(kept.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
  await shootPhone(page, "kept-with-google-phone", info.project.name, PICTURE);
  await kept.getByRole("button", { name: uiText["ui.report.close"] ?? "Close" }).click();
  await expect(page.locator("[data-way-toast]")).toHaveText("Saved with Google");
});

test("[account:guest-and-secured-states] [account:guest-reminded-to-secure] [account:start-screen-over-live-city] a kept life names its way in on Settings' account row; signing out says so once on the start screen, turned round for a browser a kept life was open in, and the notice goes when Sign in is tapped", async ({ page }, info) => {
  const sent: string[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: KEPT_WITH_GOOGLE } },
    "GET /api/moderation/standing": { body: STANDING },
    "POST /api/auth/sign-out": { body: { success: true } },
    "GET /api/age": { body: { refused: false } },
  };
  await serve(page, answers, sent);
  await page.goto("/");
  await pastTheCard(page);
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator('[data-app="settings"]').click();
  const row = page.locator("[data-account-row]");
  await expect(row).toContainText("@ada_lagos");
  await expect(row).toContainText("Signed in with Google as ada@example.com");
  await shootPhone(page, "settings-account-row-phone", info.project.name, PICTURE);
  await row.click();
  const sheet = page.getByRole("dialog", { name: uiOnlineText["ui.account.settings"] ?? "Account" });
  await expect(sheet.getByText("Signed in with Google as ada@example.com")).toBeVisible();
  await expect(sheet.getByText("Passkey: none yet")).toBeVisible();
  await shootPhone(page, "settings-account-sheet-phone", info.project.name, PICTURE);
  answers["GET /api/view"] = SIGNED_OUT;
  answers["GET /api/account"] = SIGNED_OUT;
  await sheet.getByRole("button", { name: "Sign out", exact: true }).click();
  const notice = page.getByText(uiOnlineText["ui.account.notice.signed-out"] ?? "You have signed out.");
  await expect(notice).toBeVisible({ timeout: 20_000 });
  expect(sent).toContain("POST /api/auth/sign-out");
  // A kept life was open in this browser: the way back in comes first (account:start-screen-over-live-city).
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(notice).toHaveCount(0);
  await page.getByRole("button", { name: uiOnlineText["ui.account.back"] ?? "Back" }).click();
  await expect(page.getByRole("button", { name: "Start a new life" })).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test("[account:passkeys-listed-and-removed] [account:sign-out-ends-the-session] a kept life's sheet lists its passkey by provider and day with Remove, and Sign out on every phone asks first, ends every session and says so once on the start screen", async ({ page }, info) => {
  const sent: string[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: { ...KEPT_WITH_GOOGLE, ways: { ...KEPT_WITH_GOOGLE.ways, passkeys: 1 } } } },
    "GET /api/moderation/standing": { body: STANDING },
    "GET /api/auth/passkey/list-user-passkeys": { body: [{ id: "row-1", credentialID: "b3duLWtleQ", userId: "account-guest", aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", createdAt: "2026-10-01T09:00:00.000Z" }] },
    "POST /api/auth/revoke-sessions": { body: { status: true } },
    "POST /api/auth/sign-out": { body: { success: true } },
    "GET /api/age": { body: { refused: false } },
  };
  await serve(page, answers, sent);
  await page.goto("/");
  await pastTheCard(page);
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator('[data-app="settings"]').click();
  await page.locator("[data-account-row]").click();
  const sheet = page.getByRole("dialog", { name: uiOnlineText["ui.account.settings"] ?? "Account" });
  const passkey = sheet.locator('[data-passkey="row-1"]');
  await expect(passkey).toContainText("Google Password Manager");
  await expect(passkey).toContainText("Added");
  await expect(passkey.getByRole("button", { name: /^Remove Google Password Manager, added / })).toBeVisible();
  await expect(sheet.getByText("1 passkey")).toBeVisible();
  await shootPhone(page, "settings-passkeys-phone", info.project.name, PICTURE);
  await sheet.getByRole("button", { name: "Sign out on every phone" }).click();
  await expect(sheet.getByText("This signs you out everywhere, this phone too.")).toBeVisible();
  expect(sent).not.toContain("POST /api/auth/revoke-sessions");
  answers["GET /api/view"] = SIGNED_OUT;
  answers["GET /api/account"] = SIGNED_OUT;
  await sheet.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page.getByText(uiOnlineText["ui.account.notice.signed-out"] ?? "You have signed out.")).toBeVisible({ timeout: 20_000 });
  expect(sent.filter((asked) => asked === "POST /api/auth/revoke-sessions" || asked === "POST /api/auth/sign-out")).toEqual(["POST /api/auth/revoke-sessions", "POST /api/auth/sign-out"]);
});
