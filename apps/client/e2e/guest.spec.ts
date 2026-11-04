import { expect, type Page } from "@playwright/test";
import { test } from "./support/policy";

// The guest start and keeping a guest life (account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:username-and-unconfirmed-email, account:guest-floods-are-capped, account:idle-guests-cleaned-by-hand and account:guest-reminded-to-secure), played against a faked server as online.spec.ts does: every /api
// route is answered here, in the shapes of @japacity/api.
import { uiOnlineText, uiText } from "../../../packages/content/src/index";
import { GUEST, KEPT_WITH_GOOGLE, pastFirstChapter, pastTheCard } from "./support/account";
import { type Answer, fakeServer, NO_CHARACTER, ONLINE, SIGNED_OUT, STANDING } from "./support/api";
import { shootAtSize, shootPhone } from "./support/preview";

test.use({ baseURL: ONLINE });

/** The account pictures are phone pictures, taken on the Pixel projects only, at 390 by 844. */
const PICTURE = { width: 390, height: 844 };

/** The faked server, every request kept in `sent`; the bot check's box drawn whatever it is asked. */
async function serve(page: Page, answers: Record<string, Answer>, sent: string[] = []): Promise<void> {
  await fakeServer(page, answers, { heard: (asked) => sent.push(asked), check: { drawn: true } });
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
  await sheet.getByLabel("6-digit code").fill("123456");
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
  // account:guest-reminded-to-secure: the row says the way short; the address is the sheet's alone.
  await expect(row).toContainText("Signed in with Google");
  await expect(row).not.toContainText("ada@example.com");
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

/**
 * The browser's own virtual authenticator, as a phone that can make a passkey has, so the browser says a passkey can be made
 * here (account:passkey-offered-where-it-works) and makes one with no prompt.
 */
async function passkeysHere(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

/** The auth library's registration routes as Better Auth answers them, for the address the online server runs at. */
const REGISTER: Record<string, Answer> = {
  "GET /api/auth/passkey/generate-register-options": {
    body: {
      challenge: Buffer.from("a challenge of the server's").toString("base64url"),
      rp: { name: "Japacity", id: "localhost" },
      user: { id: Buffer.from(GUEST.id).toString("base64url"), name: "ada@example.com", displayName: "ada@example.com" },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      timeout: 60_000,
      attestation: "none",
      excludeCredentials: [],
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    },
  },
  "POST /api/auth/passkey/verify-registration": { body: { id: "row-1", name: "ada@example.com", userId: GUEST.id, credentialID: "bmV3LWtleQ", counter: 0, deviceType: "singleDevice", backedUp: false, createdAt: "2026-10-26T09:00:00.000Z" } },
};

/** The welcome line told and gone, as the world tells it after a way in. */
async function lineTold(page: Page, line: string): Promise<void> {
  await expect(page.locator("[data-way-toast]")).toHaveText(line);
  await expect(page.locator("[data-way-toast]")).toHaveCount(0, { timeout: 10_000 });
}

test("[account:passkey-offered-where-it-works] a guest that keeps its life by the code is offered a passkey on a card after the welcome line; Add a passkey makes one through the browser, and a reload offers nothing", async ({ page }, info) => {
  if (info.project.name.startsWith("Pixel")) await page.setViewportSize(PICTURE);
  await passkeysHere(page);
  const sent: string[] = [];
  const answers: Record<string, Answer> = {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": { body: STANDING },
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    "POST /api/auth/sign-in/email-otp": { body: { token: "session-2", user: { id: GUEST.id, email: "ada@example.com", emailVerified: true, name: "", createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" } } },
    ...REGISTER,
  };
  await serve(page, answers, sent);
  await page.goto("/");
  await pastTheCard(page);
  const sheet = page.getByRole("dialog", { name: "Save this life" });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await sheet.getByLabel("Email").fill("ada@example.com");
  await sheet.getByRole("button", { name: "Send me a code" }).click();
  answers["GET /api/account"] = { body: { ok: true, account: { ...GUEST, state: "secured", ways: { google: null, email: "ada@example.com", passkeys: 0 } } } };
  await sheet.getByLabel("6-digit code").fill("123456");
  const kept = page.getByRole("dialog", { name: "Saved" });
  await expect(kept).toBeVisible();
  const card = page.locator("[data-passkey-card]");
  // The card never stands over an open sheet: it waits for the welcome line, which comes as the sheet closes.
  await page.waitForTimeout(1000);
  await expect(card).toHaveCount(0);
  await kept.getByRole("button", { name: uiText["ui.report.close"] ?? "Close" }).click();
  await lineTold(page, "Saved with your email");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByRole("heading", { name: "Sign in faster next time" })).toBeVisible();
  await expect(card.getByText("Use your face, fingerprint or screen lock instead of a code.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Not now" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("japacity.passkey.offered"))).not.toBeNull();
  await page.waitForTimeout(400);
  await shootAtSize(page, "passkey-card", info.project.name);
  answers["GET /api/account"] = { body: { ok: true, account: { ...GUEST, state: "secured", ways: { google: null, email: "ada@example.com", passkeys: 1 } } } };
  await card.getByRole("button", { name: "Add a passkey" }).click();
  await expect(card.getByText("Passkey added. Use it next time you sign in.")).toBeVisible();
  expect(sent.filter((asked) => asked.startsWith("GET /api/auth/passkey/generate-register-options") || asked === "POST /api/auth/passkey/verify-registration")).toEqual([
    "GET /api/auth/passkey/generate-register-options",
    "POST /api/auth/passkey/verify-registration",
  ]);
  expect(await page.evaluate(() => localStorage.getItem("japacity.account.passkey"))).toBe("1");
  await expect(card).toHaveCount(0, { timeout: 10_000 });

  await page.reload();
  await expect(page.locator('[data-thumb="phone"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(5000);
  await expect(card).toHaveCount(0);
});

test("[account:passkey-offered-where-it-works] a life kept with Google is offered a passkey once on this device: after Not now and a reload, a sign-in with Google offers nothing", async ({ page }, info) => {
  await passkeysHere(page);
  const sent: string[] = [];
  await serve(
    page,
    {
      "GET /api/view": pastFirstChapter(),
      "GET /api/account": { body: { ok: true, account: KEPT_WITH_GOOGLE } },
      "GET /api/moderation/standing": { body: STANDING },
      ...REGISTER,
    },
    sent,
  );
  await page.goto("/?google=kept");
  const kept = page.getByRole("dialog", { name: "Saved" });
  await expect(kept).toBeVisible({ timeout: 20_000 });
  await kept.getByRole("button", { name: uiText["ui.report.close"] ?? "Close" }).click();
  await lineTold(page, "Saved with Google");
  // The second chapter's mission card holds the screen as the world loads: the passkey's card waits for it to close.
  const card = page.locator("[data-passkey-card]");
  const brief = page.locator("[data-brief='chapter.build-the-file']");
  await expect(brief).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await expect(card).toHaveCount(0);
  await brief.getByRole("button", { name: "Let's go" }).click();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await shootAtSize(page, "passkey-card-google", info.project.name);
  await card.getByRole("button", { name: "Not now" }).click();
  await expect(card).toHaveCount(0);
  expect(sent.some((asked) => asked.startsWith("GET /api/auth/passkey/generate-register-options"))).toBe(false);

  await page.reload();
  await expect(page.locator('[data-thumb="phone"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(5000);
  await expect(card).toHaveCount(0);
  // A kept life signed back in to with Google: its line is told, and no card follows it on this device.
  await page.goto("/?google=in");
  await lineTold(page, "Signed in with Google");
  await page.waitForTimeout(2000);
  await expect(card).toHaveCount(0);
});
