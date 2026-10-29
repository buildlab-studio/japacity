// The account's sheets on a small phone (world:sheets-one-frame, world:reach-and-read, world:one-action-one-sheet): each
// sheet and each step of it holds its close and its main action in the window at 375 by 667 and 390 by 844, with the
// head standing when the body scrolls to its foot; a question asked in place stands where its tap was. Played against a
// faked server as guest.spec.ts does. With PREVIEW_DIR set, each sheet and step is shot at 375 by 667, named after the
// pictures of the same states taken before the sheets said one thing at a time.
import { expect, type Locator, type Page } from "@playwright/test";

import { uiOnlineText } from "../../../packages/content/src/index";
import { GUEST, KEPT_WITH_GOOGLE, pastFirstChapter, pastTheCard } from "./support/account";
import { type Answer, type Answering, fakeServer, ONLINE, STANDING } from "./support/api";
import { shootAtSize } from "./support/preview";
import { test } from "./support/policy";

test.use({ baseURL: ONLINE });
// Each test walks one sheet through all its steps at two sizes, so it takes longer than one look.
test.describe.configure({ timeout: 120_000 });

/** An iPhone SE and a common phone. */
const FIT_SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;
const SMALL = FIT_SIZES[0];

/** Whether the element stands whole inside the window. */
async function inView(page: Page, target: Locator): Promise<boolean> {
  const box = await target.boundingBox();
  const size = page.viewportSize();
  return box !== null && size !== null && box.y >= 0 && box.x >= 0 && box.y + box.height <= size.height + 0.5 && box.x + box.width <= size.width + 0.5;
}

/** The sheet's own close. */
const closeOf = (sheet: Locator) => sheet.getByRole("button", { name: "Close", exact: true });
const bodyOf = (sheet: Locator) => sheet.locator("[data-sheet-body]");

/**
 * world:sheets-one-frame: at each size, with the body at its top, the close and each main action stand whole in the window;
 * scrolled to its foot, the close still stands. The viewport is put back after.
 */
async function fits(page: Page, sheet: Locator, step: string, mains: Locator[]): Promise<void> {
  const was = page.viewportSize();
  for (const size of FIT_SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    const body = bodyOf(sheet);
    await body.evaluate((element) => element.scrollTo(0, 0));
    const at = `${step} at ${String(size.width)} by ${String(size.height)}`;
    expect(await inView(page, closeOf(sheet)), `${at}: the close`).toBe(true);
    for (const main of mains) expect(await inView(page, main), `${at}: ${(await main.textContent()) ?? ""}`).toBe(true);
    await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await page.waitForTimeout(150);
    expect(await inView(page, closeOf(sheet)), `${at}: the close, the body scrolled to its foot`).toBe(true);
    await body.evaluate((element) => element.scrollTo(0, 0));
  }
  if (was !== null) await page.setViewportSize(was);
}

/**
 * world:one-action-one-sheet: a question asked in place stands where its tap was: at each size the opener is brought into
 * view and tapped, and the question's answers stand whole in the window with nothing scrolled after the tap. `close`
 * puts the row back between sizes.
 */
async function asksInPlace(page: Page, step: string, opener: Locator, answers: Locator[], close: Locator): Promise<void> {
  const was = page.viewportSize();
  for (const size of FIT_SIZES) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    await page.waitForTimeout(400);
    const at = `${step} at ${String(size.width)} by ${String(size.height)}`;
    for (const answer of answers) expect(await inView(page, answer), `${at}: ${(await answer.textContent()) ?? ""}`).toBe(true);
    await close.click();
  }
  if (was !== null) await page.setViewportSize(was);
}

/** The state as `<name>-phone.png` or `-desktop.png` at 375 by 667, when pictures are asked for; `end` scrolls the body to its foot first. */
async function picture(page: Page, sheet: Locator, name: string, project: string, end = false): Promise<void> {
  const was = page.viewportSize();
  await page.setViewportSize(SMALL);
  await page.waitForTimeout(400);
  if (end) await bodyOf(sheet).evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await shootAtSize(page, name, project);
  if (end) await bodyOf(sheet).evaluate((element) => element.scrollTo(0, 0));
  if (was !== null) await page.setViewportSize(was);
}

/** The world past the second chapter's card, the save ask answered Not now where it comes, and the account's sheet opened from Settings. */
async function openAccount(page: Page, guest: boolean): Promise<Locator> {
  await page.goto("/");
  await pastTheCard(page);
  if (guest) {
    const ask = page.getByRole("dialog", { name: "Save this life" });
    await expect(ask).toBeVisible({ timeout: 20_000 });
    await ask.getByRole("button", { name: "Not now" }).click();
    await expect(ask).toHaveCount(0);
  }
  await page.locator('[data-thumb="phone"]').click({ timeout: 30_000 });
  await page.locator('[data-app="settings"]').click();
  await page.locator("[data-account-row]").click();
  const sheet = page.getByRole("dialog", { name: uiOnlineText["ui.account.settings"] ?? "Account" });
  await expect(sheet.locator("[data-block='you']")).toBeVisible();
  return sheet;
}

test("[world:sheets-one-frame] [world:reach-and-read] [account:guest-secures-the-life] [account:code-form-forgives] the save sheet holds Google and its close at each size, and once the code is sent, the field, Save and Not now", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": { body: STANDING },
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
  });
  await page.goto("/");
  await pastTheCard(page);
  const sheet = page.getByRole("dialog", { name: "Save this life" });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await fits(page, sheet, "the save sheet", [sheet.getByRole("button", { name: "Continue with Google" }), sheet.getByRole("button", { name: "Send me a code" })]);
  await picture(page, sheet, "10-save-ask-375", info.project.name);
  await sheet.getByLabel("Email").fill("ada@example.com");
  await sheet.getByRole("button", { name: "Send me a code" }).click();
  const field = sheet.getByLabel("6-digit code");
  await expect(field).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await expect(sheet.getByText("Or with your email")).toHaveCount(0);
  await fits(page, sheet, "the save sheet's code step", [sheet.getByText(/We sent a code to ada@example\.com/), field, sheet.getByRole("button", { name: "Save", exact: true }), sheet.getByRole("button", { name: "Not now" })]);
  await picture(page, sheet, "11-save-code-sent-375", info.project.name);
});

test("[world:sheets-one-frame] [world:one-action-one-sheet] [account:username-and-unconfirmed-email] [account:player-deletes-account] a guest's sheet, its username's step and its Delete my account step each hold their close and their main action at each size", async ({ page }, info) => {
  await fakeServer(page, {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: GUEST } },
    "GET /api/moderation/standing": { body: STANDING },
    "GET /api/username/available": { body: { ok: true, free: false } },
    "PUT /api/account/username": { status: 409, body: { ok: false, code: "not-legal", detail: "That username is taken.", name: "taken" } },
  });
  const sheet = await openAccount(page, true);
  await fits(page, sheet, "the guest's sheet", [sheet.getByRole("button", { name: "Save this life" }), sheet.getByRole("button", { name: "Change it" })]);
  await picture(page, sheet, "21-account-guest-375", info.project.name);
  await picture(page, sheet, "21-account-guest-375-end", info.project.name, true);

  await sheet.getByRole("button", { name: "Change it" }).click();
  await expect(sheet.getByRole("heading", { name: "Change your username" })).toBeFocused();
  await fits(page, sheet, "the username's step", [sheet.getByRole("button", { name: "Back" }), sheet.getByRole("textbox", { name: "Username" }), sheet.getByRole("button", { name: "Save the new name" })]);
  await picture(page, sheet, "22-rename-open-375", info.project.name);
  await sheet.getByRole("textbox", { name: "Username" }).fill("ada_kano");
  await sheet.getByRole("button", { name: "Save the new name" }).click();
  await expect(sheet.getByRole("alert")).toBeVisible();
  await fits(page, sheet, "the username's step, refused", [sheet.getByRole("alert"), sheet.getByRole("button", { name: "Save the new name" })]);
  await picture(page, sheet, "22-rename-refused-375", info.project.name);
  await sheet.getByRole("button", { name: "Back" }).click();
  await expect(sheet.getByRole("alert")).toHaveCount(0);

  await sheet.getByRole("button", { name: "Delete my account" }).click();
  await expect(sheet.getByRole("heading", { name: "Delete my account" })).toBeFocused();
  await fits(page, sheet, "deleting a guest life", [sheet.getByRole("button", { name: "Save this life first" }), sheet.getByRole("button", { name: "Delete for good" })]);
  await picture(page, sheet, "24-guest-delete-warn-375", info.project.name);
  await sheet.getByRole("button", { name: "Back" }).click();
  await expect(sheet.locator("[data-block='leaving']")).toBeVisible();
});

/** A saved life holding two passkeys whose session is older than the server allows: a deletion asks it to show it is them. */
function savedLife(): Record<string, Answer | Answering> {
  return {
    "GET /api/view": pastFirstChapter(),
    "GET /api/account": { body: { ok: true, account: { ...KEPT_WITH_GOOGLE, ways: { ...KEPT_WITH_GOOGLE.ways, passkeys: 2 } } } },
    "GET /api/moderation/standing": { body: STANDING },
    "GET /api/moderation/blocked": { body: { ok: true, blocked: [] } },
    "GET /api/auth/passkey/list-user-passkeys": {
      body: [
        { id: "row-1", credentialID: "b3duLWtleQ", userId: GUEST.id, aaguid: "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", createdAt: "2026-10-01T09:00:00.000Z" },
        { id: "row-2", credentialID: "c2Vjb25k", userId: GUEST.id, aaguid: "fbfc3007-154e-4ecc-8c0b-6e020557d7bd", createdAt: "2026-10-20T09:00:00.000Z" },
      ],
    },
    "GET /api/auth/get-session": { body: { session: { id: "s-1" }, user: { id: GUEST.id, email: "ada@example.com" } } },
    "POST /api/auth/email-otp/send-verification-otp": { body: { success: true } },
    // No code: the session is too old. A code: 111111 is refused; nothing else is sent by this spec.
    "DELETE /api/account": (body) =>
      (body as { code?: string } | null)?.code === undefined
        ? { status: 403, body: { ok: false, code: "not-fresh", detail: "Sign in again or send a code to your email." } }
        : { status: 400, body: { ok: false, code: "bad-code", detail: "That code did not work." } },
  };
}

test("[world:sheets-one-frame] [world:one-action-one-sheet] [account:passkeys-listed-and-removed] [account:sign-out-ends-the-session] a saved life's sheet holds its close at each size, and its questions asked in place stand where the tap was", async ({ page }, info) => {
  await fakeServer(page, savedLife());
  const sheet = await openAccount(page, false);
  await expect(sheet.getByText("2 passkeys")).toBeVisible();
  await expect(sheet.locator("[data-passkey]")).toHaveCount(2);
  await fits(page, sheet, "the saved life's sheet", [sheet.getByRole("button", { name: "Change it" })]);
  await picture(page, sheet, "32-account-kept-375", info.project.name);
  await picture(page, sheet, "32-account-kept-375-end", info.project.name, true);

  const everywhere = sheet.getByRole("button", { name: "Sign out on every phone" });
  await asksInPlace(page, "signing out on every phone", everywhere, [sheet.getByRole("button", { name: "Sign out everywhere" }), sheet.getByRole("button", { name: "Stay signed in" })], sheet.getByRole("button", { name: "Stay signed in" }));
  await page.setViewportSize(SMALL);
  await everywhere.scrollIntoViewIfNeeded();
  await everywhere.click();
  await shootAtSize(page, "33-signout-all-warn-375", info.project.name);
  await sheet.getByRole("button", { name: "Stay signed in" }).click();

  const remove = sheet.locator('[data-passkey="row-1"]').getByRole("button", { name: /^Remove / });
  const row = sheet.locator('[data-passkey="row-1"]');
  await asksInPlace(page, "removing a passkey", remove, [row.getByRole("button", { name: "Keep it" }), row.getByRole("button", { name: "Remove it" })], row.getByRole("button", { name: "Keep it" }));
  await page.setViewportSize(SMALL);
  await remove.scrollIntoViewIfNeeded();
  await remove.click();
  await page.waitForTimeout(400);
  await shootAtSize(page, "34-passkey-remove-ask-375", info.project.name);
  await row.getByRole("button", { name: "Keep it" }).click();
});

test("[world:sheets-one-frame] [world:one-action-one-sheet] [account:player-deletes-account] [account:code-form-forgives] deleting a saved life: the warning, the one way shown first, the code sent and a wrong code each hold the close and the main action at each size", async ({ page }, info) => {
  await fakeServer(page, savedLife());
  const sheet = await openAccount(page, false);
  const del = sheet.getByRole("button", { name: "Delete my account" });
  await del.scrollIntoViewIfNeeded();
  await del.click();
  await expect(sheet.getByRole("heading", { name: "Delete my account" })).toBeFocused();
  await fits(page, sheet, "the deletion's warning", [sheet.getByRole("button", { name: "Keep my account" }), sheet.getByRole("button", { name: "Delete for good" })]);
  await picture(page, sheet, "35-delete-warn-375", info.project.name);

  await sheet.getByRole("button", { name: "Delete for good" }).click();
  await expect(sheet.locator("[data-delete-step='confirm']")).toBeVisible();
  // One way first; the rest are quiet links, and Google's line waits until Google is picked.
  await expect(sheet.getByText("Sign in again with Google, then come back here within 10 minutes.")).toHaveCount(0);
  const way = sheet.locator("[data-delete-way]");
  const first = (await way.getAttribute("data-delete-way")) ?? "";
  expect(["passkey", "code"]).toContain(first);
  const firstMain = first === "passkey" ? sheet.getByRole("button", { name: "Delete with a passkey" }) : sheet.getByRole("button", { name: "Send a code to ada@example.com" });
  await fits(page, sheet, "the deletion's confirmation", [sheet.getByRole("button", { name: "Keep my account" }), firstMain, sheet.getByRole("button", { name: "Use Google instead" })]);
  await picture(page, sheet, "36-delete-confirm-375", info.project.name);
  await sheet.getByRole("button", { name: "Use Google instead" }).click();
  await expect(sheet.getByText("Sign in again with Google, then come back here within 10 minutes.")).toBeVisible();
  await picture(page, sheet, "36-delete-confirm-google-375", info.project.name);

  await sheet.getByRole("button", { name: "Use a code instead" }).click();
  await sheet.getByRole("button", { name: "Send a code to ada@example.com" }).click();
  const field = sheet.getByLabel("6-digit code");
  await expect(field).toBeVisible();
  const go = sheet.getByRole("button", { name: "Delete with this code" });
  await fits(page, sheet, "the deletion's code", [field, go]);
  await picture(page, sheet, "37-delete-code-sent-375", info.project.name);

  await field.fill("111111");
  await expect(sheet.locator("[data-code-said='problem']")).toBeVisible();
  await fits(page, sheet, "the deletion's code, refused", [field, go, sheet.locator("[data-code-said='problem']")]);
  await picture(page, sheet, "38-delete-code-wrong-375", info.project.name);
});

test("[world:sheets-one-frame] the other sheets in the same frame, Tell the team, Blocked and Start a new life, keep their close in view at each size", async ({ page }, info) => {
  await fakeServer(page, savedLife());
  const account = await openAccount(page, false);
  await closeOf(account).click();
  await expect(account).toHaveCount(0);
  const sheets: [string, string, string][] = [
    ["Feedback", "Tell the team", "25-feedback-empty-375"],
    ["Blocked", "Blocked", "31-blocked-empty-375"],
    ["Start a new life", "Start a new life", "57-new-life-sheet-375"],
  ];
  for (const [row, title, name] of sheets) {
    const opener = page.getByRole("button", { name: row }).first();
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    const sheet = page.getByRole("dialog", { name: title });
    await expect(sheet).toBeVisible();
    await fits(page, sheet, title, []);
    await picture(page, sheet, name, info.project.name);
    await closeOf(sheet).click();
    await expect(sheet).toHaveCount(0);
  }
});
